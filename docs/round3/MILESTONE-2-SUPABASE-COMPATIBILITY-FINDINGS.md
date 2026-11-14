# ProjectVault Round 3 — Supabase Compatibility Findings

**Reviewed:** 2026-11-14  
**Branch:** `round3-development`  
**Status:** Review notes — do not apply migration to the hosted project.

## Verified local result

The user ran `bash scripts/validate-db-local.sh` from the repository root and received:

```
PASS: local PostgreSQL 17 migration and smoke-test run completed.
NOTE: this does not replace testing on a real Supabase project.
```

This verifies the migration and the checks included in the disposable PostgreSQL 17 harness. The harness explicitly uses Auth/Storage stubs and does not verify managed Supabase, PostgREST, Auth, Realtime or Storage service behavior.

## Confirmed integration blocker: trusted invite redemption has no backend route yet

Inspection of the current `server.ts` on this branch found:
- no Supabase client initialization or Supabase SDK usage;
- no JWT/Bearer-token verification middleware;
- no invite redemption route;
- the only declared API routes are Gemini status, knowledge extraction, conflict analysis, and the static fallback route.

The migration defines `public.redeem_workspace_invite_by_hash_atomic(uuid, text)` and grants its execution only to `service_role`. It accepts a `p_user_id` parameter. This is an appropriate restricted database entry point only if the server verifies the caller's Supabase access token, derives the user ID from the verified JWT (never from request JSON), rate-limits attempts, hashes the submitted invite code server-side, and invokes the RPC using the server-only `SUPABASE_SECRET_KEY`.

**Required before enabling invite redemption:** implement and test that server boundary. Do not expose the service-role key to the browser or accept a user ID supplied by the client.

## Storage update semantics require a product decision and matching test

The migration creates a private `projectvault-sources` bucket. Its Storage UPDATE policy is `USING (false)`, so authenticated users cannot update existing objects through the Storage API. This is fail-closed, but may make replacement or `upsert: true` uploads fail.

Before changing the policy, confirm the intended behavior:
- If source files are immutable and every replacement gets a new object key, keep updates denied and test the upload flow with `upsert: false`.
- If replacing an object at the same key is required, design a narrowly scoped UPDATE policy that validates bucket, workspace membership, editor-level role, demo lock, and old/new object paths. Do not simply allow all updates.

## Additional hosted-Supabase gates still open

1. Apply the migration only to a disposable Supabase validation project/branch after explicit cost and execution approval; no hosted migration has been run.
2. Run `round3_schema_assertions.sql` on that environment.
3. Exercise actual `anon`, `authenticated`, and `service_role` JWT/API contexts. SQL Editor as postgres is not a substitute.
4. Verify transaction-bound capability behavior under PostgREST request transactions and function ownership/grants.
5. Test Google/email Auth, verified actor derivation, invite replay/expiry/revocation/concurrency, every workspace role, cross-workspace isolation, and last-owner concurrency.
6. Test real Storage upload/download/delete and intended replacement semantics.
7. Verify Realtime publication membership and event visibility.
8. Review Supabase Security, Performance, and Health Advisors after the schema exists.

## Current decision

**Local PostgreSQL 17 validation: PASS.**  
**Managed Supabase compatibility: NOT VERIFIED.**  
**Milestone 2: OPEN — not signed off.**  
**Hosted database: unchanged; do not apply the migration or merge the draft PR yet.**

The next safe implementation work is to design the Express/Supabase authentication boundary and a precise Storage object lifecycle, then add tests before any hosted migration.
