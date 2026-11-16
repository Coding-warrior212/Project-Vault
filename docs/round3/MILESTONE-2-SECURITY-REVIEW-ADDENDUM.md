# ProjectVault — Milestone 2 Security Review Addendum

**Status:** Findings verified by static review; no migration SQL applied  
**Branch:** `round3-development`  
**Supabase project:** `asjxqshuvepjsqzttafc`  
**Review date:** 2026-11-14

## Verified hosted baseline

- PostgreSQL: 17.11.
- `pg_current_xact_id()` returns type `xid8` on this project. A transaction-scoped capability design can use a full transaction ID rather than a reusable backend PID, but collision/wraparound and function ownership still require a disposable-stack proof.
- `supabase_realtime` publication exists.
- `public` and `private` contain no application tables; migration history is empty.
- Security Advisor currently returns no lints because the application schema has not been installed.
- The read-only query for `pgrst.db_schemas` returned NULL; this does not establish the Dashboard's Data API exposed-schema configuration. Verify that setting in the Supabase Dashboard before granting client access.
- No schema, data, auth, storage, or deployment settings were changed by this review.

## Confirmed security defects in the recovered SQL specification

### 1. Forgeable GUC bypasses

The SQL uses caller-settable custom settings as authorization:
- `projectvault.seed_mode`
- `projectvault.owner_rpc_active`
- `projectvault.system_event_active`
- `projectvault.cascade_cleanup`

Affected paths include demo immutability, owner membership transitions, claim/conflict/missing-info/question/handover RBAC, audit-event trust, and deleted-claim cleanup. An authenticated caller can set custom two-part GUC values inside its own transaction. These settings must never be sufficient to bypass authorization.

### 2. Service-role RPCs accept caller-supplied actor IDs

- `create_workspace_atomic(..., p_owner_id)` uses `p_owner_id` when the database role is `service_role`.
- `transfer_workspace_ownership_atomic(..., p_acting_owner_id)` uses `p_acting_owner_id` for service-role calls.
- `redeem_workspace_invite_by_hash_atomic(p_user_id, p_code_hash)` accepts the user ID as an argument.

These are only safe behind an Express boundary that validates the bearer token with Supabase Auth, derives the actor from the verified JWT, checks workspace membership/role, and never trusts actor IDs from the request body. The database cannot treat the service-role credential itself as proof of the end-user identity. The route implementation and negative tests must enforce this contract.

### 3. Invite fields are mutable beyond their intended lifecycle

The RLS update policy allows owner/admin updates but does not itself make the following fields immutable:
- `id`, `workspace_id`, `code_hash`, `code_prefix`, `granted_role`, `max_uses`, `expires_at`, `created_by`, `created_at`.

It also does not guarantee that `uses_count` only increments by one inside atomic redemption, or that `revoked_at` can only transition once from NULL to a timestamp. Add a trigger that enforces these transitions regardless of service-role/RLS bypass, and ensure only the exact redemption operation can increment the counter.

### 4. SECURITY DEFINER and grants need a full inventory

The specification creates numerous SECURITY DEFINER helpers and trigger functions. Before execution:
- inventory every function signature, owner, volatility, SECURITY DEFINER flag, search_path, and EXECUTE privilege;
- use a fixed safe search_path, schema-qualify all sensitive objects, and use a dedicated non-login owner where managed-role constraints permit;
- revoke default PUBLIC EXECUTE and grant only exact intended signatures;
- keep internal helpers in a non-exposed schema;
- explicitly grant only required table privileges to `anon` and `authenticated`; RLS does not grant table privileges or Data API exposure.

### 5. Additional integrity gaps to close

- Protect immutable identity/creator fields on every child table, including INSERT paths; the current table-specific triggers do not uniformly cover all columns and tables.
- Lock the parent workspace row for last-owner invariants so concurrent membership changes cannot race.
- Ensure audit inserts are attributable to a verified actor; a caller-supplied `actor_source = 'server_verified'` string is not proof.
- Prefer FK cascades/constraints over custom cleanup bypasses. Any retained cleanup capability must be operation-specific and unforgeable.
- Keep service-role demo write rejection explicit; RLS is bypassed by service_role. Storage has its own managed schema and cannot rely on application-table triggers.
- Check that every SECURITY DEFINER function and every exposed RPC is protected against accidental execution by PUBLIC/anon.

## Required implementation architecture

1. Use a non-exposed `private` schema for capability metadata and internal helpers.
2. Use a transaction-bound capability keyed by `pg_current_xact_id()` (`xid8` on the hosted project) and a narrowly defined operation, created only by an explicitly granted trusted entry point. Do not grant API roles direct writes to capability metadata.
3. Validate the function owner and grants on the actual Supabase managed role model. Do not assume that creating a NOLOGIN role or changing function ownership is permitted until a rollback-only probe confirms it.
4. Keep seed execution migration/operator-only. No runtime API role may mint a seed capability.
5. Split user-JWT RPCs from service-only RPCs. User RPCs derive identity from `auth.uid()`; service-only calls are made only after Express verifies the JWT and checks membership/role.
6. Apply explicit Data API table/function grants and RLS together; leave membership, invite, and source-file metadata private to the intended roles.
7. Add invite lifecycle triggers and parent-row locking for last-owner protection.
8. Test the complete adversarial matrix on a disposable local Supabase stack before any hosted migration.

## Acceptance tests before hosted apply

- Each API role attempts every legacy GUC bypass; all unauthorized attempts fail.
- API roles cannot read/write capability metadata or execute internal helpers.
- Each SECURITY DEFINER function has only intended EXECUTE grants and a verified owner/search_path.
- Service-role routes reject an actor ID that differs from the verified JWT subject.
- Demo mutations fail through direct REST, RPC, Express, and Storage paths, including service-role backend paths.
- Invite immutable fields, one-way revocation, exact +1 counter update, replay, expiry, and parallel max-use race are tested.
- Last-owner removal/demotion is safe under concurrent transactions.
- Cross-workspace foreign keys and UUID-array claim references reject foreign IDs.
- Realtime publication membership, Storage object policies, and private bucket access are verified.
- Seed counts, foreign keys, and read-only demo behavior are verified.
- Run Supabase Security/Performance Advisors after migration and inspect all findings.

## Decision

**Milestone 2 is not ready for hosted application.** The hosted project remains empty and unchanged. PostgreSQL 17.11 supports an `xid8` transaction identifier, which is useful evidence for the proposed capability design, but it does not prove the complete design is safe. The next gate is to implement and test the migration on a disposable local Supabase stack, then re-run the security matrix and advisors. Only after those pass should the hosted migration be applied.
