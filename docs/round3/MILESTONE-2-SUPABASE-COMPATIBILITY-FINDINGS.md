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

## Review addendum — 2026-11-16

### Latest confirmed verification

GitHub Actions run [#43758917330](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43758917330) is confirmed complete with both jobs successful. The application job completed invite/server tests, TypeScript type-check, production build, Chromium install, and browser E2E. The database job completed the local PostgreSQL 17 runner that applies every migration. This is still stubbed local validation, not managed Supabase sign-off.

The PR currently contains 58 changed paths. No submitted review records or inline review threads were returned by the GitHub review APIs. The two Render IP-throttling commits described below were created after run #43758917330, so they still require a new CI result.

### Render-aware invite throttling fix

The route previously fell back to `req.socket.remoteAddress` unless `PROJECTVAULT_TRUST_CF_CONNECTING_IP=true` was explicitly configured. Render's current documentation says inbound web-service traffic passes through Cloudflare and recommends using a client-IP header; Cloudflare documents `CF-Connecting-IP` as a single-address header for requests from its edge to an origin. Using the socket peer as the default on Render risks putting unrelated visitors into the same rate-limit bucket. The router now defaults to a validated `CF-Connecting-IP` when `RENDER=true`, keeps the explicit `PROJECTVAULT_TRUST_CF_CONNECTING_IP` override, and continues to ignore `X-Forwarded-For`.

- Code commit: `ef3962306984903a124e0f7010dc551bffc0967c`
- Regression-test commit: `065faf5b2c37fc03be2203b438975a660724142a`
- CI for these commits: **pending at review time**.
- The rate limiter remains in-memory and process-local; it is not a distributed limiter for a multi-process/multi-instance deployment. No paid Redis/Key Value service is proposed.

References: [Render DDoS and client-IP guidance](https://render.com/articles/how-render-handles-ddos-attacks), [Render default environment variables](https://render.com/docs/environment-variables), and [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

### Potential last-owner race — open security blocker

Static review found that the owner-minimum AFTER trigger counts remaining owners but does not lock the parent workspace row first. The direct membership DELETE policy permits an owner to remove another membership (and permits self-removal). Two concurrent transactions deleting different owner rows may each observe the other transaction's uncommitted owner row, pass the count check, and commit, leaving zero owners. This has not been reproduced with two live sessions; treat it as a high-priority potential race until tested.

Recommended correction: serialize owner membership removal/demotion on the parent workspace row before evaluating the final owner count, or disallow direct owner membership deletion and require a single atomic RPC with a consistent lock order. Add a two-session regression test that attempts concurrent owner removals and asserts that one transaction fails and exactly one owner remains. Do not mark owner-minimum protection verified until that test passes.

### Membership revocation session-staleness risk

The AuthGate re-queries memberships when session/workspace access is refreshed, but the workspace Realtime subscription currently covers application data tables and does not include `workspace_members`. If a member is removed while their app is open, the active workspace selection and already-loaded client-side records may remain visible until refresh, although RLS should reject subsequent reads/writes. This is a static integration risk; a revocation-in-an-open-session browser test and an explicit client state-clearing path are still required.

### Hosted Supabase status — read-only recheck

- PostgreSQL 17.11; `supabase_realtime` publication present.
- Zero application tables in `public` and `private`; Supabase migration-list API returned zero entries.
- Security, Performance, and Health Advisors returned no lints on the empty schema.
- No hosted database, Auth, Storage, secret, or deployment changes were made.

**Milestone 2 remains OPEN.** The latest local CI run is green, but managed Supabase roles/ownership, PostgREST transaction-bound capability behavior, actual JWT/RLS matrix, Auth, Storage, Realtime, concurrency, and post-migration advisors remain unverified. The owner-removal race and membership-revocation session behavior must also be closed before the security sign-off.


### CI follow-up — 2026-11-16

Run [#43813310350](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43813310350) completed successfully on the current branch head. Both the application and database jobs passed, including server tests, typecheck, build, Chromium Playwright E2E, and the complete local PostgreSQL 17 migration/assertion/adversarial harness. This run includes the Render-aware invite-throttling code and regression test. Wait for the full application job before treating the current branch head as green.


## 2026-11-17 review — application integration and owner lifecycle

### Current application integration (verified from the development branch)

The earlier sections above describe earlier development snapshots and are superseded where they say that the app has no Supabase client/Auth UI/cloud persistence or that Gemini endpoints are unauthenticated.

- Browser integration uses `@supabase/supabase-js` with only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `AuthGate` provides email/password sign-up/sign-in, Google OAuth initiation, password recovery, session restoration, workspace membership lookup, workspace creation, invite redemption, and an isolated interactive local Judge Demo.
- `workspaceCloud.ts` persists workspace data through the user's Supabase client/JWT and provides private Storage upload/download/delete plus Realtime subscriptions.
- `server/supabaseInvite.ts` validates sessions through Supabase Auth, derives the user ID from Auth, hashes invite codes server-side, and calls the service-role-only redemption RPC with the server-only secret key.
- `server/geminiAuth.ts` validates the session with `auth.getUser`, checks membership through the user's JWT/RLS, and enforces route-specific roles. The guard now requires `is_anonymous === false`; the new unit test is included in `npm run test:server`.
- The Gemini routes read source/claim data with the user's JWT. Availability still depends on the server-side Gemini key and managed-backend behavior; no live route verification was performed in this run.

### Storage object lifecycle clarified

The current upload code uses a random UUID in every object path and `upsert: false`. A replacement is uploaded as a new object key and a new `source_files` metadata row; downloads select the newest metadata row, while source deletion removes all associated object paths. The SQL UPDATE policy that denies same-key updates therefore does not block the implemented upload/replacement path. Same-key upsert remains unsupported by design. Real Storage API behavior and cleanup failure handling still need managed testing.

### Last-owner race mitigation committed

Static review confirmed that the previous membership DELETE policy allowed an owner to delete their own owner row, while the AFTER trigger only counted remaining owners. The new migration `20261117110000_require_atomic_owner_membership_changes.sql` closes the direct owner DELETE path in both RLS and the membership trigger. Owner changes must use the capability-gated ownership-transfer RPC, which locks membership rows in a deterministic order; workspace deletion uses its dedicated capability.

The schema assertions and local smoke tests now cover:
1. RLS denial of direct owner self-deletion;
2. trigger denial when a privileged SQL role attempts a direct owner delete without the atomic capability;
3. successful atomic transfer and demotion of the previous owner; and
4. former-owner departure after transfer while the new owner remains.

These tests are committed but require a fresh CI result. They do not replace a managed two-session/PostgREST concurrency test.

### Membership-revocation client handling

The main-branch AuthGate fix has been backported to the development branch. A membership lookup failure now clears the selected workspace, and a Realtime event on the current user's `workspace_members` rows triggers a fresh membership lookup. This improves stale UI state handling; delivery of membership DELETE events under managed Realtime/RLS remains unverified.

### Migration-history discrepancy and hosted-state limitation

At the start of this review, the development repository contained ten migration files. PR #1's current description and the submission draft report eleven hosted migrations, including a follow-up security-permissions migration that is not identifiable among those ten files. This review adds an owner-guard migration, but it is not that previously reported security-permissions migration. Do not infer that the hosted history is reconciled from migration counts alone.

The 2026-11-15 read-only snapshot reported zero hosted application tables and zero migration records. Later PR/release notes report fourteen tables and eleven migrations. The Supabase skill was not available from the connected skill registry in this run, so no current hosted Supabase calls were made. Current hosted state, migration history, table/RLS state, advisors, Auth, Storage and Realtime must be treated as **unverified**.

### Verification status

- Development branch head before today's changes: `7d0360f8f949ae27bba40b0c1afc6450eef8a260`.
- Branch run [#43813583777](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43813583777) passed both jobs before today's new migration/tests/Auth changes.
- Submission-preparation run [#43880847494](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43880847494) has both jobs recorded as successful.
- The owner-guard migration, AuthGate backport, strict Gemini identity test and updated docs need a new CI run.
- Milestone 2 remains **OPEN — not signed off**. No hosted migration, deployment, merge, secret change or paid service was used.

## 2026-11-17 follow-up — owner lifecycle and CI result

### Owner-membership lifecycle

The current branch includes `20261117110000_require_atomic_owner_membership_changes.sql`. It replaces the earlier direct-owner-removal exposure with two layers:
- the authenticated DELETE policy excludes rows whose role is `owner`;
- the SECURITY DEFINER membership trigger rejects owner-row deletion unless the transaction has the expected internal capability.

The existing ownership-transfer RPC locks all membership rows for the workspace in deterministic order before checking the caller and changing roles. Workspace deletion uses its separate authenticated, actor-bound capability path and locks invites/memberships before deleting the workspace.

The local smoke test verifies direct owner self-delete is denied by RLS, a privileged SQL path without the capability is rejected by the trigger, atomic transfer demotes the previous owner, and the former owner can subsequently leave while the new owner remains. The final state assertion must run outside the former owner's RLS context; otherwise RLS correctly hides the remaining membership after departure.

### Test defects found and corrected

Two consecutive CI failures exposed defects in the smoke test:
1. Several PL/pgSQL blocks used a single-dollar delimiter (`DO $` / `$;`), which PostgreSQL rejects. These were corrected to `$$`.
2. The former-owner departure test attempted to verify the new owner's row before resetting the former owner's role. That query was filtered by RLS, producing a false failure even though the transfer had succeeded. The test now performs the DELETE under the former owner's JWT, resets the role/claim, then inspects final membership state as the local database owner.

**Verification:** CI run [#44028139080](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44028139080) passed both jobs on branch commit `08369cbe56ad5b9a790b6bcf16ac3945b50f11cd`, including the complete eleven-migration PostgreSQL 17 harness and application E2E job.

This proves the local harness path only. It does not prove a two-session managed concurrency test or PostgREST request behavior.

### Application-side revocation and Storage findings

- AuthGate has a filtered Realtime subscription to the signed-in user's `workspace_members` rows. A membership event triggers a fresh RLS-authorized membership query; no membership or a query failure clears the active workspace. Managed DELETE event delivery still needs live validation.
- File upload uses `<workspace>/<source>/<uuid>-<safe filename>` with `upsert: false`; replacement uses a new object key. The Storage UPDATE policy remains deny-all and does not block the current upload path. Managed Storage API behavior and cleanup-failure recovery remain unverified.

### Current hosted-state limitation

The repository now contains eleven migration files. PR/release documentation reports eleven hosted migrations and fourteen public tables with RLS, while the last independently verified hosted snapshot (2026-11-15) reported zero application tables and zero migration records. The connected Supabase skill was unavailable during this review, so no current hosted calls were made. The exact hosted migration history and current tables/advisors/Auth/Storage/Realtime state remain **unverified**. Do not apply or replay any migration on the hosted project based on this report.

### Release gates still open

1. Reconcile the exact hosted migration history with all checked-in SQL files and identify the reported follow-up security-permissions migration.
2. Verify function owners, grants and transaction-bound capability behavior through real PostgREST/API role contexts.
3. Test all five workspace roles and cross-workspace isolation with real JWTs.
4. Test invite expiry/revocation/replay/concurrency and the invite endpoint's service-role boundary.
5. Test Storage upload/download/delete and membership revocation through managed Realtime.
6. Run a managed two-session owner-transfer/removal concurrency test.
7. Review Security, Performance and Health Advisors against the actual populated schema.

**Milestone 2 remains OPEN — not signed off.**

### Main/development migration drift — verified 2026-11-17

GitHub's recursive tree shows:
- `main` at `d8e6452dbd656983e6c73a7349a3106345e4be37` contains **10** migration files;
- `round3-development` contains **11** migration files;
- the only additional development migration is `20261117110000_require_atomic_owner_membership_changes.sql`.

Render auto-deploys from `main`, and its latest listed live deployment is the `main` commit above. Therefore the new owner-guard migration is **not present in the deployed main source tree**. There is no current verified evidence that an equivalent owner guard is installed in hosted Supabase. Treat last-owner protection in the live environment as unresolved until the exact hosted schema is inspected.

PR #1/release notes report eleven hosted migrations, including a follow-up security-permissions migration that is not present in either current branch migration directory. The repository's 10-versus-11 migration count and the reported hosted count are not reconciled. Do not apply, replay, merge, or deploy migrations to resolve this automatically; first identify and archive the exact hosted migration history and SQL.

## 2026-11-18 review — branch, deployment, and membership-revocation hardening

### Repository and deployment state verified from GitHub and Render

- `round3-development` head at the start of this review: `cb83c7adde50ee5a3fec97d3f7a9d82fcbfccb70`. The latest completed verification for that head was GitHub Actions run [#44028581080](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44028581080); both the application and PostgreSQL 17 jobs succeeded.
- This review added a membership-revocation invalidation fix and a unit test. Code commits: `78c19ae`, `c10fb5b`, `5843563`, `1a420eb`, and `3812038`. A fresh CI run for the new code is pending; the previous green run does not cover these commits.
- GitHub branch metadata reports `protected: false` for `round3-development`. The branch-protection detail endpoint returned 403 to the connected integration, so detailed protection/ruleset configuration could not be inspected.
- The current comparison reports `round3-development` and `main` as diverged (234 commits ahead, 3 behind, merge base `67cd33b`). PR #1 and PR #2 are closed and merged. PR #3, “Fix Google OAuth error handling”, remains open against `main` from `fix/oauth-invite-reliability`; it has no submitted reviews or inline review threads in the current review API response. Do not merge it automatically.
- Render service `Project-Vault` is on the Free plan, auto-deploys from `main`, and its latest listed live deployment is commit `5f3657cffe0fada2ebb22a32814492dd1c48965c`. No deployment was triggered by this review.
- The checked-in migration directories contain 10 SQL files on `main` and 11 on `round3-development`. The only additional development migration is `20261117110000_require_atomic_owner_membership_changes.sql`. It is not in the deployed `main` source tree. Do not infer that the equivalent guard exists in hosted Supabase.

### Membership revocation and Realtime authorization finding

Static review found that AuthGate previously subscribed to `workspace_members` with `event: '*'` and a `user_id` filter. Supabase documents that DELETE filtering requires `REPLICA IDENTITY FULL`; with RLS enabled, the old record may still expose only the primary key, so a `user_id` filter is not a reliable revocation signal. Supabase also documents that Realtime authorization is cached for the connection until JWT expiry or a new token is sent. A removed member could therefore retain an open workspace subscription until the client revalidates and unsubscribes.

The development branch now:
- filters INSERT and UPDATE notifications to the signed-in user's `user_id`;
- listens for `workspace_members` DELETE without a row filter and treats it only as an invalidation signal (the payload is ignored);
- re-queries the signed-in user's memberships through RLS; and
- relies on the app's active-workspace effect cleanup to remove the workspace data channels when membership is no longer returned.

The unfiltered DELETE signal is intentionally coarse: it can cause other connected users to re-check their own membership after a membership deletion. The code does not consume or expose the deleted row payload. The table is already in the `supabase_realtime` publication. A unit test was added to assert the event/filter registration and cleanup behavior.

This is a code-level mitigation, not managed Realtime acceptance. Test actual DELETE delivery, RLS behavior, revocation timing, and channel cleanup against the connected Supabase project before sign-off.

Official references:
- [Supabase Postgres Changes — DELETE filters and replica identity](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Postgres Changes troubleshooting — RLS and old records](https://supabase.com/kb/troubleshooting/realtime-postgres-changes-troubleshooting)
- [Supabase Realtime authorization — policy cache and revocation](https://supabase.com/docs/guides/realtime/authorization)

### Additional code review observations

- `server.ts` mounts the invite router before the general 16 KB JSON parser, so the invite router's dedicated 2 KB parser is not shadowed by the global parser.
- `server/geminiAuth.ts` validates the bearer session with Supabase Auth, rejects anonymous users, looks up membership through the user's JWT/RLS, and checks route-specific role allowlists.
- `workspaceCloud.ts` uses workspace-scoped table filters and authenticated client operations. Source files use UUID object keys and `upsert: false`, so the deny-all Storage UPDATE policy does not block the implemented replacement path; same-key upsert remains unsupported.
- The membership revocation fix is committed but its new CI result is pending. No local/managed Supabase runtime test was performed in this review.

### Hosted Supabase status and milestone disposition

The Supabase skill is not currently available in the connected skill registry (the skill listing returned no entries and the documented URI returned Resource not found). Therefore no current connected Supabase read-only query was run. The last independently verified hosted snapshot remains 2026-11-15 (zero application tables and zero migration history); later project notes report a populated 14-table/11-migration state, but that later state remains unverified. Do not apply or replay migrations.

- Milestone 1 — development foundation: substantial code and CI exist; branch drift and absent protection remain process risks.
- Milestone 2 — Supabase foundation: **OPEN — not signed off**. Managed schema/history, function owners/grants, PostgREST capabilities, JWT/RLS matrix, Storage, Realtime revocation, owner concurrency, and populated-schema advisors remain unverified.
- Milestone 3 — Auth/RBAC: implementation present; managed email confirmation, Google provider/callback, invite lifecycle and all-five-role acceptance remain pending. PR #3 is still open.
- Milestone 4 — cloud persistence/Realtime: workspace adapter and subscriptions are implemented; managed acceptance and a verified local-to-cloud importer remain outstanding.
- Milestone 5 — promised improvements: shared workspace foundation, public GitHub manual sync and evidence graph exist; private GitHub OAuth/background sync and automated dependency/staleness propagation are not delivered.
- Milestone 6 — Judge Demo: interactive browser-local isolation is covered by Playwright; it is not read-only.
- Milestone 7 — security/E2E: previous code-bearing CI passed; this review's membership-revocation change needs a fresh run, and managed security tests remain open.
- Milestone 8 — final deployment/submission: Render is live from `main`; final PDF, live managed acceptance evidence, individual contribution statements and submission confirmation are not verified.

No hosted schema/data/Auth/Storage settings, secrets, GitHub merge, Render deployment, or paid resource was changed. No user action is required for this review.
