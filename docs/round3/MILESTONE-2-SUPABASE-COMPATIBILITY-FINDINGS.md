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

## Server-side invite redemption boundary added; integration remains pending

The branch now contains `server/supabaseInvite.ts`, mounted before the large-document JSON parser, plus focused tests in `server/supabaseInvite.test.ts`. The route:
- accepts only a normalized `PV-XXXX-XXXX` code and a Bearer session token;
- asks Supabase Auth's `/auth/v1/user` endpoint to validate the session, requires `is_anonymous === false`, and derives the UUID from that response (request-body user IDs are ignored);
- hashes the normalized code with SHA-256 server-side;
- calls the service-role-only RPC using `SUPABASE_SECRET_KEY` on the `apikey` header only (never as a Bearer token);
- applies a bounded in-memory per-IP attempt limit, a 2 KB route body limit, and 10-second upstream request timeouts;
- returns sanitized error messages and does not expose raw Postgres/Auth response bodies.

The test command is `npm run test:server`. **It has been committed but has not yet been executed in this environment**, so behavior is not marked tested. The endpoint is not yet connected to a sign-in UI, and it cannot work until the server environment contains `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. The secret must remain server-only.

Supabase's current JWT documentation recommends validating HS256 user sessions through the Auth `/auth/v1/user` endpoint when the server does not use a JWT verification SDK; the new publishable/secret key guidance says secret keys belong in backend code and should be sent on the `apikey` header, not as a Bearer token. See https://supabase.com/docs/guides/auth/jwts and https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys.

**Remaining integration work:** run the automated tests and TypeScript/build checks, wire a real browser Auth flow, and verify the route against a disposable Supabase environment after explicit approval. Do not expose the service key to the browser or accept a user ID supplied by the client.

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

## Review addendum — 2026-11-14

### Supabase-specific Storage semantics

The current Storage policy set has a SELECT policy for workspace members, an INSERT policy for owner/admin/editor, an UPDATE policy with `USING (false)`, and a DELETE policy for owner/admin/editor. This deliberately prevents updates. Supabase Storage upsert/replacement requires the caller to have the relevant SELECT, INSERT, and UPDATE permissions; therefore same-key upsert is not supported by this policy set. This is a confirmed functional restriction, not automatically a security defect.

**Decision still required from product behavior:** whether source objects are immutable and replacements use a new object key, or whether same-key replacement is a supported workflow. Until decided, preserve the deny-by-default UPDATE policy. If replacement is required, design a constrained UPDATE policy and test both old-row and new-row path checks; do not broadly enable updates.

### API and client integration state

The checked `package.json` still contains no `@supabase/supabase-js` dependency; the new invite endpoint uses Supabase Auth and PostgREST HTTP endpoints directly with Node's built-in `fetch`. `server.ts` now mounts the verified invite route. The app itself still has no Supabase sign-in UI or Supabase-backed persistence route; its existing persistence remains browser-side IndexedDB/localStorage. Consequently, the SQL migration is only partially connected to the running application.

### Validation scope clarification

The user's successful local run proves that the migration executes in the local PostgreSQL 17 harness and that the harness's included assertions/smoke checks pass. The smoke SQL currently verifies seeded demo data, capability cleanup, and resistance to a forged seed-mode GUC in its local role setup. It is not a complete adversarial matrix for all five workspace roles, invite concurrency, Storage API operations, PostgREST request transaction behavior, or Realtime authorization.

### Safe next implementation sequence

1. Run `npm run test:server`, `npm run lint`, and `npm run build`; fix any failures.
2. Wire browser Supabase Auth (Google and email/password) to the new invite endpoint without ever exposing the secret key.
3. Define immutable-source-file versus same-key replacement behavior, then align Storage policy and upload code.
4. Add tests for the storage lifecycle and actual role/tenant isolation.
5. Verify the invite route, RLS, RPC grants, and Storage against a disposable Supabase environment only after explicit execution/cost approval.
6. Keep Milestone 2 open until all required Supabase-specific gates are verified. No hosted migration, deployment, merge, or secret change is authorized by this review.


## Invite replay correctness fix — 2026-11-14

A further code review found an idempotency edge case in the original SQL RPC: it checked `uses_count >= max_uses` before checking whether the authenticated user was already a workspace member. If the first redemption committed at the final allowed use but the HTTP response was lost, a retry by that same user returned `INVITE_EXHAUSTED` instead of the existing membership result.

The development migration now checks existing membership before enforcing the use limit (while still rejecting unknown, revoked, expired, and demo-workspace invites). The local adversarial smoke SQL now creates a one-use invite, redeems it once, retries as the same user, and asserts that the second call is idempotent and the counter remains exactly one.

**Verification status:** code and regression test are committed; the updated local PostgreSQL script has **not yet been rerun** after this change. Do not treat this fix as runtime-verified until that rerun passes.

The invite route also fails closed for anonymous Auth users: Supabase's verified user response must explicitly report `is_anonymous: false`. The test suite now includes an anonymous-user denial case. Reference: https://supabase.com/docs/guides/auth/users.

## High-priority application security gap: Gemini endpoints remain unauthenticated

The current `server.ts` still exposes `POST /api/gemini/extract-knowledge` and `POST /api/gemini/analyze-conflicts` without a Supabase session or workspace-role check. These handlers use the server-side Gemini API key. A publicly reachable endpoint can therefore consume the project's Gemini quota and process caller-supplied content without proving workspace membership.

The new invite route does not solve this. Before the app is treated as a secure multi-user deployment, add a shared Supabase-authenticated middleware, reject anonymous/demo sessions for live AI operations, derive the actor from the verified Auth response, and enforce the relevant workspace contributor role using a trusted workspace ID. Update the frontend to send the session token and workspace ID. Keep the read-only Judge Demo path away from Gemini calls. Add negative tests for missing/expired/anonymous sessions and non-member/viewer roles.

This is an application integration blocker; it is separate from the database RLS review.


## 2026-11-15 review — migration-set and append-only audit follow-up

The hosted Supabase project was rechecked read-only on 2026-11-15:
- PostgreSQL 17.11.
- `supabase_realtime` publication exists.
- No application tables in `public` or `private`; migration history remains empty.
- Security, Performance and Health Advisors return no lints on the empty schema. This is not a schema security sign-off.
- `pgrst.db_schemas` is NULL from the read-only setting query; Dashboard Data API exposure configuration remains unknown.

The migration-set review found that the original local runner applied only the first SQL file. The runner now applies all migration files in lexical order. GitHub Actions run [#43681066786](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43681066786) passed the application job and the PostgreSQL 17 job using the full migration set and updated schema assertions.

Migration `20261115120000_preserve_append_only_activity_references.sql` now:
- drops the source, claim and actor-user `ON DELETE SET NULL` foreign keys that would otherwise try to UPDATE append-only activity rows;
- preserves those identifiers as immutable historical audit references; and
- validates newly inserted source/claim references against the event's workspace.

The cloud Realtime subscription now includes `activity_events`, which is loaded by the cloud adapter but was previously omitted from the subscription list.

Commit `47b085b` adds local adversarial checks that valid same-workspace references can be inserted, cross-workspace source/claim references are rejected, and deleting a referenced source/claim does not rewrite the immutable event. These checks passed in GitHub Actions run [#43681406630](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43681406630). The same run includes commit `c7bd137`, which adjusts the invite-route tests to exercise the route's own 2 KB parser and confirms an oversized payload is rejected before any Supabase request.

**Milestone 2 remains OPEN.** The CI PostgreSQL harness is not managed Supabase. PostgREST transaction-bound capability behavior, managed function ownership/grants, Auth, Storage API, Realtime delivery, full role/tenant isolation, and concurrency remain unverified. The hosted database was not modified.
