# ProjectVault Round 3 — Database Validation Runbook

**Scope:** Disposable Supabase branch only. Do not run the first migration on production.

## Before applying

1. Confirm the target is a disposable local PostgreSQL harness or an explicitly approved temporary Supabase validation environment.
2. Review every SQL file in `supabase/migrations/` on the current branch; the local runner applies all files in lexical filename order.
3. Confirm the environment has no production data. Never import production records into the validation database.
4. Apply the migration set as the database migration owner.

## Automated assertions

Run `supabase/tests/round3_schema_assertions.sql` against the disposable branch. It checks:
- all 14 application tables and RLS enablement;
- private capability schema/table/function access denial for API roles;
- service-role-only invite redemption RPC;
- fixed search_path for SECURITY DEFINER functions;
- absence of legacy `projectvault.*` custom-GUC bypasses;
- invite lifecycle trigger and private Storage bucket.

The second half prints the installed table grants and RLS policies for manual inspection.

## Required adversarial tests

Run with actual Supabase JWTs and role contexts. Do not treat SQL Editor's postgres session as a substitute for API-role tests.

1. anon cannot read private workspace data or mutate any table.
2. authenticated non-member cannot read or mutate a workspace.
3. each role (owner/admin/editor/reviewer/viewer) is tested against the permission matrix.
4. attempt `set_config('projectvault.seed_mode','on',true)`, `owner_rpc_active`, `system_event_active`, and `cascade_cleanup` from authenticated; all bypass attempts must fail to authorize the forbidden write.
5. direct authenticated INSERT of owner membership fails; only workspace creation/ownership transfer RPC may establish an owner.
6. service_role direct workspace_members changes fail without the matching internal capability.
7. demo workspace mutation fails through REST and service-role paths.
8. invite immutable fields cannot be changed; uses_count cannot be forged or incremented by more than one; revoked_at cannot be cleared or changed after first revocation; physical delete fails.
9. invite redemption is tested for invalid hash, expiry, revocation, max uses, replay, already-member idempotency, and concurrent redemption at the max-use boundary.
10. cross-workspace source/claim/node references fail.
11. activity_events UPDATE/DELETE fail; actor attribution from trusted RPCs matches the capability actor.
12. direct owner membership deletion is denied; atomic ownership transfer and former-owner departure are tested locally. A managed two-session concurrency test remains required.
13. Storage upload/download/delete is tested for all roles and demo workspace.
14. realtime subscription visibility is tested for members and non-members.

## Completion criteria

Milestone 2 is complete only when the migration applies cleanly, automated assertions pass, adversarial tests pass, and Supabase Security/Performance/Health Advisors are reviewed. Capture test output and the final schema/types in the repository. Only then prepare the hosted migration for a separate controlled apply.


## Zero-cost local PostgreSQL validation

You do not need a paid Supabase branch for the first migration smoke test.

From the repository root, with Docker Desktop installed and running:

```bash
bash scripts/validate-db-local.sh
```

The script starts a temporary PostgreSQL 17 container on the local machine, creates minimal stand-ins for Supabase Auth and Storage dependencies, applies every `supabase/migrations/*.sql` file in lexical order, runs schema assertions, and runs the invite-replay and demo-lock/custom-GUC smoke tests. The container is automatically removed on exit.

The test uses no cloud database and does not change the hosted Supabase project. The first Docker run may download the PostgreSQL image.

**Limitations:** local stubs cannot prove managed Supabase role ownership, PostgREST transaction behavior, OAuth/Google Auth, Realtime delivery, actual Storage API semantics, Edge Function behavior or production concurrency characteristics. Passing the local script is necessary but not sufficient for a production migration.

## Server invite-boundary tests

After installing the repository dependencies, run:

```bash
npm run test:server
npm run lint
npm run build
```

These checks do not require Supabase credentials. The invite endpoint itself requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SECRET_KEY`; do not put the secret in any `VITE_` variable or browser bundle. The endpoint validates user sessions through Supabase Auth, then calls the service-role-only invite RPC with the authenticated user ID returned by Auth.

## Invite redemption retry regression

The local adversarial smoke script also tests that a one-use invite can be retried idempotently by the same user after a successful redemption, without incrementing `uses_count` a second time. Re-run the full local validation script after changes to the migration or smoke SQL.


## Append-only activity reference migration

The migration set removes `ON DELETE SET NULL` foreign keys from activity-event source, claim, and Auth-user identifiers. Those automatic updates conflict with the append-only activity trigger. Historical identifiers remain in the audit row after the related operational record or Auth user is deleted. A BEFORE INSERT trigger validates that any new source/claim reference belongs to the event's workspace. The schema assertions require this trigger and verify that the incompatible foreign keys are absent.


## Atomic owner membership changes

Migration `20261117110000_require_atomic_owner_membership_changes.sql` denies direct deletion of owner membership rows through both RLS and the membership trigger. Ownership changes must use `transfer_workspace_ownership_atomic`; workspace deletion uses `delete_workspace_atomic`. The local smoke test verifies RLS denial, trigger denial under RLS bypass, successful transfer, and former-owner departure. This does not replace a managed Supabase/PostgREST concurrency test.

## Membership revocation broadcast

Migration `20261118100000_membership_revocation_broadcast.sql` sends a private Broadcast to `pv-membership-revoked:<user_id>` after a workspace membership row is deleted. The `realtime.messages` SELECT policy permits only the authenticated user whose UID matches the topic. AuthGate listens on that user-specific private channel, then re-queries memberships through RLS and clears the active workspace if access was revoked.

The local PostgreSQL stand-in records attempted `realtime.send` calls so the smoke test can verify the topic, event, payload, and RLS policy shape. It does not emulate WebSocket delivery or managed Realtime authorization caching. The live DELETE-to-private-Broadcast path must still be tested against managed Supabase before Milestone 2 sign-off.

## Anonymous SECURITY DEFINER helper access

The development branch now includes migration `20261122110000_revoke_anon_execute_from_security_helpers.sql`, which removes anonymous EXECUTE from `public.is_authenticated_non_demo()` and `public.is_demo_workspace(text)`. Authenticated EXECUTE is retained because these helpers are referenced by authenticated RLS policies. The schema assertions verify both sides of this grant boundary. This aligns the branch with the read-only hosted ACL snapshot observed on 2026-11-22; the hosted migration name that changed the grants is known, but its SQL contents were not available through the migration-list API, so exact migration equivalence is not claimed.

## Anonymous API access is disabled

The Judge Demo is browser-local; public Supabase read access is not part of the intended demo path. Migration `20261122120000_revoke_anonymous_workspace_table_access.sql` removes `anon` SELECT on all 14 public application tables and changes the demo-readable SELECT policies to `authenticated` only. Authenticated users can still read demo rows through the existing RLS expressions and their workspace data through membership/role policies. The schema assertions verify no anonymous SELECT table grants or anon SELECT-policy roles remain, and no anon EXECUTE on public SECURITY DEFINER functions remains. This avoids the permission error observed in the hosted read-only role simulation where anon SELECT on `workspaces` attempted to invoke `is_workspace_member`, which anon cannot execute. The migration is development-only and has not been applied to hosted Supabase.


## Supabase public-schema default ACL parity

The disposable bootstrap now seeds the Supabase-style default privileges granted to the `postgres` migration owner in `public` (API-role table, sequence, and function grants). This is intentional: without it, vanilla PostgreSQL defaults would make the ACL regression test pass without exercising the hosted Supabase condition.

Migration `20261124110000_restrict_public_default_privileges.sql` revokes inherited API-role defaults for future public tables, sequences, and functions. It also normalizes the existing public SECURITY DEFINER function ACLs to the reviewed helper/RPC allowlist. New public objects must receive explicit, narrowly scoped grants from their own migration.

The migration and assertions are development-branch only. Do not apply them to hosted Supabase until the full migration-history reconciliation and Milestone 2 acceptance process is complete.
