# ProjectVault Round 3 — Database Validation Runbook

**Scope:** Disposable Supabase branch only. Do not run the first migration on production.

## Before applying

1. Confirm the branch is a temporary validation environment.
2. Confirm the migration is the current branch version:
   `supabase/migrations/202611140001_projectvault_round3.sql`.
3. Confirm the branch has no production data. Supabase development branches are fresh databases; do not import production records.
4. Apply the migration as the database migration owner.

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
12. last-owner demotion/removal race is stress-tested with two concurrent sessions.
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

The script starts a temporary PostgreSQL 17 container on the local machine, creates minimal stand-ins for Supabase Auth and Storage dependencies, applies the migration, runs schema assertions and runs a demo-lock/custom-GUC smoke test. The container is automatically removed on exit.

The test uses no cloud database and does not change the hosted Supabase project. The first Docker run may download the PostgreSQL image.

**Limitations:** local stubs cannot prove managed Supabase role ownership, PostgREST transaction behavior, OAuth/Google Auth, Realtime delivery, actual Storage API semantics, Edge Function behavior or production concurrency characteristics. Passing the local script is necessary but not sufficient for a production migration.
