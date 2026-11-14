# ProjectVault — Milestone 2 Database Foundation Review

**Status:** Design review in progress — NOT READY TO APPLY  
**Branch:** `round3-development`  
**Supabase project:** `asjxqshuvepjsqzttafc`  
**Reviewed:** 2026-11-14

## Live project baseline (read-only checks)

- `public` and `private`: zero application tables.
- Migration history: zero migrations.
- Supabase Security Advisor: zero current lint findings (expected on an empty schema; this is not evidence that the proposed schema is secure).
- No database objects or data were changed during this review.

## Intended database scope

The architecture specifies 14 public tables:

1. `profiles`
2. `workspaces`
3. `workspace_members`
4. `workspace_invites`
5. `sources`
6. `source_files`
7. `claims`
8. `conflicts`
9. `missing_info`
10. `questions`
11. `handovers`
12. `activity_events`
13. `graph_nodes`
14. `graph_edges`

It also specifies workspace-scoped composite foreign keys, five roles (owner/admin/editor/reviewer/viewer), RLS, immutable Judge Demo data, three privileged RPCs, a private Storage bucket, Realtime publication membership, and deterministic demo seed data.

## Blocking findings — must fix before migration approval

### 1. User-settable custom GUCs are used as privilege bypasses

The proposed triggers trust settings including:

- `projectvault.seed_mode`
- `projectvault.owner_rpc_active`
- `projectvault.system_event_active`
- `projectvault.cascade_cleanup`

A custom PostgreSQL setting is not, by itself, proof that a trusted SECURITY DEFINER function or migration operator set it. A caller can generally set arbitrary two-part custom settings in its own transaction. Therefore, checks such as:

```sql
current_setting('projectvault.seed_mode', true) = 'on'
```

must not authorize bypassing demo immutability, owner-only transitions, audit trust, or RBAC. This affects more than one trigger. Replace the bypass with a verifiable trusted execution boundary (for example, a dedicated non-login function-owner role and narrowly scoped SECURITY DEFINER entry points, with privilege checks that ordinary API roles cannot forge). Seed execution must use an equally non-forgeable operator-only path. Re-audit every trigger that reads these settings.

### 2. Public Data API grants/exposure are not specified

The migration enables RLS and defines policies, but the review must also explicitly define table/function privileges for `anon` and `authenticated`. Supabase's 2026 change means new public tables are no longer automatically exposed to the Data API; this is now enforced for all projects. RLS policies do not grant SQL privileges or expose a table by themselves.

Before implementation, specify the minimal `GRANT` matrix, revoke unnecessary defaults, and verify the project's Data API exposure configuration. In particular, demo reads should be limited to the intended demo tables/rows; private membership, invite, and source-file metadata must not become publicly readable.

### 3. Trusted service-role actor validation depends on the Express boundary

The invite-redemption and service-role RPC paths accept user IDs supplied by the backend. The database must not treat a request-body user ID as authenticated identity. The Express implementation must validate the Supabase access token server-side, derive the actor from the verified token, check workspace membership/role before using `SUPABASE_SECRET_KEY`, and pass only that verified actor to trusted RPCs. The DB design and route contract need a matching negative-test matrix.

### 4. Function execution privileges and search paths need a complete inventory

Every SECURITY DEFINER function must have an explicit owner, fixed safe search_path, and explicit EXECUTE grants. Revoke default PUBLIC execution, including for helper functions not intended as API entry points. Keep internal helpers in a non-exposed schema where practical. Verify all trigger functions and RPC overload signatures, not only the three named RPCs.

### 5. Seed and demo immutability must be tested as adversarial cases

The seed block currently depends on `seed_mode`; until that mechanism is replaced, it is a direct blocker. Tests must prove that anon, authenticated users (including owner), and service-role requests cannot mutate the demo workspace after seed completion, and cannot impersonate the seed/operator context.

## Additional correctness checks before implementation

- Verify every workspace-scoped table has demo-lock and cross-workspace reassignment protection where applicable.
- Verify immutable `created_by`, `workspace_id`, creator/actor identity, and invite security fields cannot be spoofed or rewritten by direct table operations.
- Verify invite `uses_count` can only increment inside atomic redemption; `revoked_at` is one-way; immutable invite fields remain immutable; admin cannot issue admin/owner invites.
- Verify last-owner protection under concurrent transactions and workspace cascade deletion.
- Verify claim-array validation and cleanup cannot be bypassed with a user-settable GUC.
- Verify activity events are append-only and actor identity is derived from verified JWT/profile data.
- Verify Storage path parsing, bucket restrictions, private object access, and upload/update/delete semantics.
- Verify all referenced tables/columns exist before creating functions and triggers; run the complete migration against a disposable local Supabase stack first.
- Confirm seed row counts and all composite foreign keys before allowing demo access.
- Add negative tests for every role, anon, service role, cross-workspace IDs, forged GUCs, invite replay/races, last-owner removal, and demo writes.

## Supabase platform compatibility note

The current Supabase changelog states that new public tables are no longer automatically exposed to the Data/GraphQL APIs, with enforcement across projects from 2026-10-30. The schema migration must therefore include an intentional grants/exposure plan rather than assuming that RLS policies alone make the app work.

## Decision

**Do not apply the proposed SQL yet.** The database is currently empty and unchanged. The architecture is a useful schema baseline, but the forgeable GUC bypasses and missing explicit Data API privilege plan are release-blocking. Next implementation step is to revise the trusted execution boundary and privilege matrix, then produce a single reviewed migration and test it locally before any hosted application.


## 2026-11-14 execution update

A first draft migration is now committed at:
`supabase/migrations/202611140001_projectvault_round3.sql`

A read-only schema assertion suite is committed at:
`supabase/tests/round3_schema_assertions.sql`

Static inspection of the committed migration confirms:
- 14 application table definitions.
- 15 RLS-enable statements (14 application tables plus the private capability table).
- 60 policy definitions (including Storage policies).
- 41 trigger definitions.
- No remaining references to caller-settable `projectvault.*` custom GUCs in the migration.
- One explicit transaction boundary around schema and seed work.
- Private transaction-bound operation capability helpers.
- Invite lifecycle trigger protecting immutable fields, one-way revocation, and redemption-only +1 use counter changes.
- Internal activity-event actor is taken from the transaction-bound capability rather than an arbitrary event payload.

**These are static checks only.** The migration has not been executed. The assertion suite has not been run. Function ownership, transaction-ID capability semantics under actual PostgREST transaction behavior, RLS/grants, trigger ordering, concurrent owner-removal behavior, and Storage access must still pass on a disposable Supabase database before any hosted apply.

### Required validation gates
1. Apply migration to a disposable Supabase branch.
2. Run `supabase/tests/round3_schema_assertions.sql`.
3. Execute adversarial tests using anon, authenticated, and service_role contexts, including custom-GUC attempts, invite tampering/replay/races, demo writes, cross-workspace references, and owner-removal races.
4. Inspect Security, Performance, and Health Advisors.
5. Only then review and authorize applying the migration to the hosted project.

The temporary Supabase validation branch was quoted at **$0.01344/hour**. Creation is waiting for explicit cost approval.


## Local validation preparation update — 2026-11-14

- Corrected six malformed single-dollar PL/pgSQL function delimiters found during static review; all function bodies now use paired `$$` delimiters.
- Added a local PostgreSQL 17 bootstrap with minimal Auth/Storage stubs:
  `supabase/tests/local-bootstrap.sql`.
- Added local smoke checks for seeded demo data, capability cleanup and forged `projectvault.seed_mode` GUC attempts:
  `supabase/tests/local-adversarial-smoke.sql`.
- Added a no-cloud local runner:
  `scripts/validate-db-local.sh`.
- Added instructions and explicit scope limitations in `supabase/tests/README.md`.

Latest static scan of the committed migration:
- 2,650 lines / 124,286 bytes.
- 14 application tables, all 14 with RLS enabled.
- 60 policies, 41 triggers, 27 functions.
- 25 SECURITY DEFINER functions; all have a fixed search_path.
- Balanced parentheses and dollar-quoted blocks; no unterminated SQL lexical states.
- No remaining caller-settable `projectvault.*` privilege GUC checks.
- One top-level BEGIN/COMMIT pair.

**Execution status:** the local runner has been committed but has not been executed in this environment: Docker, PostgreSQL client/server binaries and outbound package/image network access are unavailable here. Therefore the migration is still unexecuted, and Milestone 2 remains open. The user can run the free local script from the repository root when Docker Desktop is available. A passing local run must not be represented as proof of Supabase-hosted behavior.


### Final delimiter correction

A second pass over every function terminator found two inline `END; $;` delimiters missed by the first repair. Both are now corrected to `END; $$;` in commit `0e324f9`. The final lexical scan reports 29 balanced dollar-quoted blocks, no unclosed strings/comments/blocks, balanced parentheses, and all 25 SECURITY DEFINER functions with fixed search_path.

Updated static counts: 14 public tables + 1 private capability table; RLS on all 14 public tables and the private capability table; 60 policies; 41 triggers; 27 functions; 25 SECURITY DEFINER functions. These are static source counts, not evidence of successful database execution.
