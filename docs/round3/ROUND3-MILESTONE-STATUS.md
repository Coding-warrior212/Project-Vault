# ProjectVault Round 3 — Milestone Status

**Snapshot:** 2026-11-20
**Repository:** `Coding-warrior212/Project-Vault`  
**Working branch:** `round3-development`  
**Release constraints:** free-only; preserve `main` and the hosted Supabase project until explicit release approval.

## Executive status

The development branch has advanced beyond the earlier authentication-only snapshot. It now contains browser Supabase Auth UI, a workspace-scoped cloud data adapter, private Storage upload/download/delete paths, public GitHub documentation snapshots, a derived source-to-claim knowledge graph view, and an isolated browser-local Judge Demo.

**No milestone is fully signed off overall yet.** The Judge Demo acceptance decision is resolved and its browser isolation regression now passes in CI: interactive local edits, default-workspace preservation through entry/exit/reset, and no Supabase write requests during the tested demo flow. Managed Supabase and the other release gates remain open. The last independently verified hosted snapshot (2026-11-15) was empty. Later PR/release notes report eleven hosted migrations and fourteen public tables. The current audit could not recheck the connected project, so the live hosted state is unresolved; do not assume either the old empty state or the later reported migrated state. The earlier GitHub Actions run [#43620652179](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43620652179) passed, but its database runner applied only migration 1. That gap was corrected in later runner changes. Run [#43681406630](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43681406630) passed both jobs on an earlier code snapshot, applying all migration files in PostgreSQL 17 and running server tests, typecheck, build, and smoke assertions. The later code-bearing run [#44244690750](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44244690750) failed both jobs due test-harness syntax defects; three repairs are committed afterward, but the latest CI run on branch head `5fea6371332b475aceec7506119dc3d0c4fa4abf` is **failed** (run #44679254146).

## Eight-milestone tracker

| # | Milestone | Current status | Verified progress | Remaining blockers / acceptance evidence |
|---|---|---|---|---|
| 1 | Development foundation | In progress | Review began at `ce659f3d55ecc40f83f0f77b8062a3e19c25dfad`; documentation-only review commits subsequently advanced the branch ref. At the review snapshot it compared to `main` as 267 commits ahead and 3 behind (merge base `67cd33b0a003c7590c12f5d18a5b2a316167a1ea`). PR #1, #2, and #4 are merged; PR #3 remains open. The development branch remains diverged. Do not force-reset or rebase until squash-merge ancestry is reconciled. | Complete a full branch review, confirm the current PR head/status, review CI on the latest commit, and resolve the non-blocking large production-bundle warning. |
| 2 | Supabase foundation | **Open — not signed off** | Draft 14-table schema, RLS, policies, triggers, RPCs, private Storage bucket, demo seed and assertions exist. Run #43681406630 passed the local PostgreSQL 17 harness after it was changed to apply all migrations in lexical order, including the append-only activity-reference smoke checks. Migration 2 now removes all three append-only-incompatible `ON DELETE SET NULL` references (source, claim and Auth user) and validates new source/claim references at insert time. The last independently verified 2026-11-15 read-only snapshot showed PostgreSQL 17.11, the Realtime publication, zero app tables/migration records and no advisor lints on the empty schema. Later PR/release notes report eleven migrations and fourteen tables; the current hosted state was not rechecked. | Managed Supabase roles/function ownership, PostgREST transaction-bound capability behavior, RLS/API role tests, Storage, Auth, Realtime, concurrency, and advisors after schema installation remain unverified. The hosted project must remain unchanged. The hosted managed-Supabase gates remain open. The latest branch's three CI syntax repairs are committed, but a post-fix workflow run/status is not available through the connected GitHub workflow tools in this review. |
| 3 | Authentication and RBAC | In progress — implementation present, managed runtime pending | Browser client uses publishable key only. AuthGate includes email/password sign-up/sign-in, Google OAuth initiation, password recovery/update, session restoration, sign-out, workspace membership lookup, workspace creation RPC and invite redemption. Server invite route validates the session through Supabase Auth and derives the user ID from the Auth response. | Verify real email confirmation/reset delivery, Google provider and callback configuration, invite redemption against managed Auth/PostgREST, all five roles and outsider isolation. Do not put the secret key in browser variables. |
| 4 | Cloud persistence and Realtime | Partially implemented; end-to-end sign-off pending | `workspaceCloud.ts` loads/saves sources, claims, conflicts, missing-info findings, questions and activity events; it has private-bucket file operations, signed downloads, handover persistence and Realtime subscriptions. App selects cloud persistence only inside an authenticated workspace. | Full local-Supabase E2E is still required. A verified local-to-cloud importer with orphan filtering, row-count verification and a non-destructive preservation check is not present in the reviewed code. Realtime now subscribes to `activity_events` as well as the other workspace tables; build/typecheck passed in run #43681066786. |
| 5 | Three promised improvements | Partial | Shared workspace access/invite foundation exists. Public GitHub repositories can be snapshotted and manually synced to a pinned commit. The Knowledge Graph page shows source-to-claim evidence links and related review state. | GitHub private-repo OAuth/background sync is absent. The graph is a derived evidence view, not persisted graph-node/edge construction or automatic dependency/change-impact/staleness propagation. Complete and test the promised depth or explicitly scope the submission claims. |
| 6 | Judge Demo | Interactive local demo isolation verified; milestone acceptance met | Product acceptance is explicitly **interactive**, not read-only. New Playwright browser E2E test passes in CI: seeds default localStorage and IndexedDB records, enters the demo, verifies a claim-review decision persists under the demo namespace, uploads a source into the separate demo database, exits, re-enters and resets. Default workspace records remain byte-for-byte unchanged after exit and reset; demo IndexedDB/localStorage data is cleared; no write requests reach Supabase/test backend hosts. Gemini routes now validate Supabase sessions, workspace membership and route-specific roles; live managed-backend behavior and API-key availability remain unverified. | Keep this isolation test in CI and do not describe the demo as read-only. This verifies the tested browser flow; it is not a substitute for managed Supabase or full application security testing. |
| 7 | Security and end-to-end testing | Open — post-fix CI pending | Workflow run #44244690750 failed both jobs on test syntax. The server test job stopped before typecheck/build/browser E2E; the database job failed before migration execution. Three repairs were committed (`4db1146`, `c0af5f7`, `f53fb5c`) and textually checked in the follow-up `ce659f3`; no post-fix CI status is exposed for the current branch head. Managed Supabase and live Gemini behavior remain unverified. | Verify CI on the current development head; run the full local Supabase matrix: anon/authenticated/service_role, owner/admin/editor/reviewer/viewer, cross-workspace isolation, invite expiry/revocation/replay/concurrency, last-owner races, Storage and Realtime. Add protected Gemini route tests before re-enabling AI. Local PostgreSQL stubs are not managed Supabase validation. |
| 8 | Final deployment and submission | Not ready | The release draft reports a Render deployment and hosted migrations, but this audit did not independently verify those claims. No deployment or production migration was performed by this automation run. | Only after gates pass: separately approved production migration/deployment, end-to-end smoke test, updated project PDF, improvements list, technical details, testing notes and verified individual team contributions. |

## Historical hosted Supabase baseline — read-only snapshot (2026-11-15)

Project `asjxqshuvepjsqzttafc`:
- PostgreSQL version: **17.11**.
- `supabase_realtime` publication: present.
- Application base tables in `public` and `private`: **0**.
- Migration history rows: **0**.
- `pgrst.db_schemas`: NULL from the read-only setting query; this does not prove the Dashboard's exposed-schema configuration.
- Security, Performance and Health Advisor responses: no lints on the empty schema; these are not a security sign-off for the proposed schema.

No schema, data, Auth provider, Storage, secret, or deployment settings were changed.

## Findings and changes from this review

1. **Migration runner coverage gap fixed:** `scripts/validate-db-local.sh` now applies every `supabase/migrations/*.sql` file in lexical order. Run #43681066786 passed the full migration set and updated schema assertions.
2. **Append-only audit integrity hardened:** migration 2 now drops source, claim and actor-user `ON DELETE SET NULL` foreign keys, and validates new source/claim references against the same workspace at INSERT time. The schema assertions passed in run #43681066786. The cross-workspace/source-deletion smoke tests and the oversized invite-body test passed in CI run #43681406630.
3. **Realtime completeness fixed:** `subscribeWorkspaceChanges` now subscribes to `activity_events`, matching `loadWorkspaceData`.
4. **Storage semantics:** the bucket is private, uploads use unique object paths with `upsert: false`, and the SQL UPDATE policy remains denied. Same-key replacement is intentionally unsupported until a narrowly scoped update policy and test are designed.
5. **AI availability:** extraction and conflict-analysis endpoints remain fail-closed with HTTP 503 until verified session, workspace, source and role authorization is implemented. This is a deliberate security mitigation, not a completed AI workflow.
6. **Judge Demo isolation verified:** Playwright now exercises the interactive claim-review and source-upload paths inside the demo, confirms the separate `ProjectVault_DB_judge_demo` store is used, checks the pre-existing `ProjectVault_DB` and default localStorage values after exit and reset, confirms demo records are cleared, and asserts no write requests are sent to Supabase/test backend hosts. The test is part of the required GitHub Actions job.

## Exact user actions

**Nothing is required from the user today.** Continue using the existing free local tooling. Do not create a paid Supabase branch or apply the draft migrations to the hosted project. When a real Auth/provider or local browser validation step becomes necessary, provide the exact dashboard clicks/commands and request only the required user-side action.

## Release rules

- Never apply these migrations to the hosted project without a separate explicit production approval.
- Never deploy, merge, change secrets, or modify live schema/data in this workflow. PR #1 and #2 are closed; closure does not authorize further release actions.
- Keep the service/secret key server-only; never use a `VITE_` prefix for it.
- Do not mark Milestone 2 complete based on PostgreSQL stubs or empty-schema advisors.
- The accepted Judge Demo is interactive within its isolated browser-local store; never claim it is read-only.
- Keep the passing Judge Demo browser isolation regression in CI. It verifies tested demo flows only; do not generalize it into a full managed-backend security sign-off.

## Automation review — 2026-11-16

### Verified repository and CI state

- The `round3-development` branch exists and compares to `main` as ahead and 0 behind at review time. This is a branch-history comparison, not a statement that every development commit is release-ready.
- PR #1 and #2 are closed. The review APIs returned no submitted review records or inline review threads.
- GitHub Actions run [#43758917330](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43758917330) is confirmed complete with both jobs successful: server tests/typecheck/build/Playwright E2E, and all-migrations PostgreSQL 17 validation plus adversarial smoke tests.
- Two follow-up commits from this review improve Render-aware invite throttling. Their CI result is **pending** at the time of this note; do not reuse the previous green run as evidence for those new commits.

### New findings and mitigations

1. **Render invite rate-limit client identity:** the invite router previously used `req.socket.remoteAddress` unless an opt-in environment flag was set. Render documents that inbound web-service traffic passes through Cloudflare and recommends using the client-IP header; Cloudflare documents `CF-Connecting-IP` as a single-address origin header. The router now automatically trusts a syntactically valid `CF-Connecting-IP` only when `RENDER=true`, unless `PROJECTVAULT_TRUST_CF_CONNECTING_IP` explicitly overrides the behavior. It continues to ignore `X-Forwarded-For`. A regression test covers two clients and a forged forwarded-for header. This code is committed; CI is pending.
2. **Potential last-owner concurrency race — not yet reproduced:** `workspace_members_delete_policy` allows an owner to delete another membership, while `enforce_owner_minimum_after_change()` checks the remaining owner count in an AFTER trigger without first locking the parent workspace row. Two concurrent owner deletions of distinct membership rows may each see the other transaction's uncommitted owner row and both pass the count check, leaving the workspace ownerless. This is a static concurrency risk, not a reproduced exploit. Before sign-off, serialize owner membership removal/demotion on the workspace row (or route all such changes through a single locking RPC) and add a two-session race regression test.
3. **Membership revocation UI refresh — not yet verified:** `AuthGate` loads memberships during session/workspace access refresh, but the workspace Realtime subscription list does not include `workspace_members`. A membership revoked while a user is already in the workspace may leave the active workspace selection and already-loaded browser state visible until a refresh, even though RLS should reject subsequent database requests. Add a revocation/session-staleness E2E test and ensure the client clears the active workspace when access is no longer present.

### Hosted Supabase recheck — read-only

- PostgreSQL **17.11**.
- `supabase_realtime` publication exists.
- Zero application tables in `public` and `private`.
- Zero migration history entries returned by the Supabase migration-list API.
- Security, Performance, and Health Advisors returned no lints on the empty schema.
- No hosted schema/data/Auth/Storage/secret/deployment setting was changed.

### Milestone disposition

Milestone 2 remains **OPEN — not signed off**. The green CI run validates the disposable PostgreSQL harness and tested application flows, not managed Supabase/PostgREST/Auth/Storage/Realtime behavior. The newly identified owner-race and membership-revocation checks must be resolved before security sign-off. No user action is required for this review; no hosted migration, merge, or deployment is authorized.


### CI follow-up — 2026-11-16

- GitHub Actions run [#43813583777](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43813583777) passed both jobs on the development branch head before the new 2026-11-17 changes. The new owner-guard migration, strict Gemini identity check, and AuthGate backport require a fresh CI run.
- PR #1 metadata reports **60 changed files**, is open, draft, unmerged, and mergeable at this check. The branch head is `7abe16baea877ce18564e72e63492011758b2b49`.


## Review addendum — 2026-11-17

### Repository and pull-request state

- At the start of this review, `round3-development` was `7d0360f8f949ae27bba40b0c1afc6450eef8a260`; `main` was `d8e6452dbd656983e6c73a7349a3106345e4be37`.
- GitHub reported the refs as diverged (214 ahead / 2 behind at that point). PR #1 and PR #2 are closed. Their closure timestamps coincide with web-flow commits on main, but the issue API view did not expose a definitive merged flag. Preserve the development branch; do not force-reset/rebase based on commit counts alone.
- PR review APIs returned no submitted reviews or inline review threads.
- Branch-head run [#43813583777](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43813583777) passed both jobs before the new changes in this addendum. Run [#43880847494](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43880847494) also has both jobs recorded as successful for the submission-preparation work. The new changes below need a fresh run.

### New development-branch work

- Backported the main-branch AuthGate hardening: membership lookup failures clear the selected workspace; membership-table Realtime events trigger a fresh server-authorized lookup.
- Added `20261117110000_require_atomic_owner_membership_changes.sql`. Direct owner membership deletion is denied by RLS and by the membership trigger; ownership must be transferred through the capability-gated atomic RPC, or the workspace must be deleted through its dedicated RPC.
- Added schema assertions and adversarial smoke tests for RLS denial, trigger denial under RLS bypass, atomic ownership transfer, and former-owner departure. These tests are committed but pending a fresh CI result.
- Gemini authorization now requires `is_anonymous === false`; a unit test covers anonymous, missing, malformed and valid user identities.
- Replaced the generated README and added the Round 3 final submission readiness draft. The draft explicitly distinguishes implemented scope from live acceptance evidence.

### Eight-milestone disposition

| Milestone | Current disposition |
|---|---|
| 1 — Development foundation | In progress; PRs closed, branch history remains diverged |
| 2 — Supabase foundation | **Open**; local PostgreSQL checks are not managed Supabase sign-off |
| 3 — Authentication and RBAC | Implementation present; managed Auth/provider, invite and five-role matrix pending |
| 4 — Cloud persistence and Realtime | Adapter present; full browser/managed Storage and Realtime acceptance pending |
| 5 — Promised improvements | Partial; public GitHub sync and derived evidence graph only |
| 6 — Judge Demo | Interactive browser-local isolation verified by CI; not read-only |
| 7 — Security and E2E | Local CI exists; managed role, tenant, concurrency and Realtime matrix pending |
| 8 — Final deployment/submission | Draft exists; final PDF, contributions and release acceptance not verified |

### Hosted Supabase evidence conflict

The previous read-only snapshot on 2026-11-15 reported zero application tables and zero migration history. PR #1's current description and the submission draft later report eleven hosted migrations, fourteen public tables, RLS, and seeded data. At the start of this review the repository had ten migration files; this review adds a new owner-guard migration, which is **not** the reported extra security-permissions migration. The exact reported hosted migration remains unidentified.

The Supabase skill was not available from the connected skill registry during this run, so no current hosted Supabase tool calls were made. Treat the current migration history, table count, seed rows, advisor output, Auth/Storage configuration and project status as **unverified** until a fresh read-only check is available.

No production database, Auth, Storage, secret, deployment or merge action was performed. No paid infrastructure was created.

## 2026-11-17 follow-up verification — current branch head

**Reviewed branch head:** `08369cbe56ad5b9a790b6bcf16ac3945b50f11cd`  
**CI:** [Run #44028139080](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44028139080) — **both jobs passed**.

The successful run verifies:
- server security tests;
- TypeScript type-check;
- Vite production build;
- Playwright browser E2E;
- all eleven checked-in SQL migrations in lexical order on disposable PostgreSQL 17;
- schema assertions and the adversarial smoke suite, including owner self-delete denial, trigger denial, atomic transfer, former-owner departure, invite replay, demo immutability, and append-only activity references.

The run is local/disposable PostgreSQL validation, not managed Supabase acceptance.

### Corrected review findings

- The owner-guard smoke test initially had malformed single-dollar PL/pgSQL block delimiters. They were corrected.
- The next run exposed an RLS-observation mistake: after the former owner leaves, their JWT correctly cannot see the remaining owner's membership row. The test now performs the deletion under the former owner's JWT, resets role/claims, and checks final membership state as the local database owner. The latest run passes.
- AuthGate already subscribes to the current user's `workspace_members` changes and clears the selected workspace when access disappears or membership verification fails. Managed Realtime DELETE delivery still needs live testing.
- Storage upload uses unique UUID object paths with `upsert: false`; the deny-all UPDATE policy does not block the current replacement path because replacement creates a new object. Same-key upsert remains unsupported.

### Updated eight-milestone disposition

| Milestone | Current disposition |
|---|---|
| 1 — Development foundation | Branch and CI exist; PR #1 and #2 merged into main. Development branch remains diverged and unprotected. |
| 2 — Supabase foundation | **Open — not signed off.** Eleven checked-in migrations pass disposable PostgreSQL 17. Current hosted migration history, managed roles/ownership, PostgREST capabilities, RLS matrix, Storage, Auth, Realtime, concurrency and post-schema advisors are unverified. |
| 3 — Authentication and RBAC | AuthGate, email/password, Google OAuth initiation, workspace membership and server invite boundary exist. Google provider, live email/reset, invite RPC, and all five roles still need managed acceptance. |
| 4 — Cloud persistence and Realtime | Workspace data adapter, private file operations and Realtime subscriptions exist. Managed Storage/Realtime acceptance and a verified local-to-cloud importer remain outstanding. |
| 5 — Three promised improvements | Shared workspace foundation exists; GitHub is public-repository/manual sync; graph is derived source-to-claim evidence. Private OAuth/background sync and automatic persisted change-impact propagation are not delivered. |
| 6 — Judge Demo | Interactive browser-local demo isolation passes Playwright E2E. It is not read-only. |
| 7 — Security and E2E | Current local CI passes. Managed JWT/RLS, concurrency, Storage, Realtime and live Gemini tests remain open. |
| 8 — Final deployment/submission | Render free service is live from `main`; development branch is not deployed. Final PDF, live end-to-end evidence, member contributions and submission confirmation remain outstanding. |

### Deployment and repository facts

- Render service `Project-Vault` is on the free plan, configured to auto-deploy from `main`; latest listed deployment is live at commit `d8e6452dbd656983e6c73a7349a3106345e4be37`.
- PR #1 and PR #2 were merged on 2026-11-16. No merge or deployment was performed by this automation.
- The development branch is unprotected; no branch-protection settings were changed.
- The current repository has eleven migration files. The later report of eleven hosted migrations/fourteen public tables is not independently rechecked in this run. The last verified hosted snapshot is 2026-11-15 and was empty; the Supabase skill was unavailable, so current hosted state must remain **unverified**.

**User action required today:** none. No hosted migration, deployment, secret change, merge, or paid resource is requested or performed.

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

## 2026-11-18 follow-up — targeted private membership-revocation Broadcast

The earlier same-day review proposed an unfiltered Postgres DELETE invalidation handler. That approach would have caused every connected subscriber to re-check membership after any membership deletion. It has been superseded by a narrower, user-targeted private Broadcast.

### Current implementation on `round3-development`

- New migration: `20261118100000_membership_revocation_broadcast.sql`.
- An AFTER DELETE trigger sends `realtime.send(..., 'membership_revoked', 'pv-membership-revoked:' || OLD.user_id, true)`.
- A SELECT policy on `realtime.messages` permits only the authenticated user whose `auth.uid()` matches the user ID encoded in the private topic.
- AuthGate keeps filtered Postgres INSERT/UPDATE subscriptions for the signed-in user's own membership and listens on a separate private Broadcast channel `pv-membership-revoked:<user_id>`.
- On notification, AuthGate re-queries memberships using the user's JWT/RLS. If the active workspace is no longer authorized, the existing app effect clears its data and removes the workspace Realtime channels.
- The Broadcast payload contains only the workspace ID and is treated as an invalidation signal, never as authorization evidence.

### Local validation added

- The disposable PostgreSQL Realtime stand-in now records calls to `realtime.send`; it still does not emulate WebSocket delivery.
- The schema assertions require the private per-user SELECT policy, trigger, and Broadcast call.
- The adversarial smoke test verifies that the removed member can read their own notification topic and a different authenticated user cannot read that topic.
- A TypeScript unit test verifies the two filtered membership handlers, private per-user Broadcast channel configuration, and channel cleanup.

The local test suite must pass on the latest branch head before this change is considered locally verified. Managed Realtime delivery, private-channel authorization, actual token-cache behavior, and end-to-end revocation timing remain required before Milestone 2 sign-off.

### Migration and release state

- `main` still contains 10 migration files.
- `round3-development` now contains 12 migration files: the additional owner-membership guard and this new membership-revocation Broadcast migration.
- Render still auto-deploys from `main`; neither development-only migration is present in the currently listed live deployment source tree.
- The Supabase skill remains unavailable in the connected skill registry, so current hosted schema/history and advisor state remain unverified. No hosted migration was applied.

**Milestone 2 remains OPEN — not signed off.** No production changes, deployment, merge, secret change, or paid resource was made.

## 2026-11-19 review — CI failure triage and test syntax repairs

### Verified CI failure on the preceding code snapshot

Workflow run [#44244690750](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44244690750) ran on commit `a11331b8b52903d77eea01fadfaa06dd4a72659a` and **failed both jobs**. Retrieved job logs identify three test-harness syntax defects (not an application runtime failure):

- `supabase/tests/local-bootstrap.sql`: the disposable `realtime.send` stand-in had single-dollar function-body delimiters (`AS $` / `$;`), causing PostgreSQL syntax error.
- `supabase/tests/local-adversarial-smoke.sql`: two private Broadcast authorization checks used malformed `DO $` / `$;` delimiters.
- `src/services/membershipRealtime.test.ts`: the mocked `removeChannel` function had `return 'ok',` instead of a valid statement terminator.

### Repairs committed to `round3-development`

- `4db1146443d7cb363b6bb656b8a120c80d01b2d3` — corrected the Realtime SQL stand-in function delimiters.
- `c0af5f7a16c47b3949496ba1565eb4981662b985` — corrected both smoke-test DO block delimiters.
- `f53fb5c94c19820f786b58b9cd631625acbef8dd` — corrected the membership Realtime test mock syntax.

These changes are reviewed textually and committed, but **a new CI run is required** to confirm they compile and pass together. No local Docker/PostgreSQL execution was available in this automation runtime.

### CI follow-up

The prior workflow failure must not be represented as green. The application job failed while running server tests; later typecheck/build/browser steps were skipped. The database job failed before migrations due to the malformed local Realtime stub. The three corrections above target those logged failure causes; the new branch snapshot remains unverified until CI completes successfully.

**Milestone 2 remains OPEN — no managed Supabase compatibility/security sign-off.** No production schema/data, Auth/Storage settings, secrets, merge, deployment, or paid resource was changed.

### Follow-up static verification of the repair commits

After the three CI-failure fixes were committed, the current files were re-fetched from `round3-development` and scanned textually: the local Realtime stub has **5 opening/5 closing `$$` function tags** and no malformed single-dollar `AS $`/`$;` tags; the smoke test has **12 `DO $$` blocks and 12 `$$;` closers** with no malformed `DO $`/`$;` tags; the membership test contains `return 'ok';` and no old `return 'ok',` fragment. This is a static delimiter/syntax-pattern check only, not PostgreSQL execution or TypeScript compilation. CI result for the post-fix branch is not exposed by the connected workflow-run tools in this review, so verification remains pending.
## 2026-11-20 review — branch-head and CI recheck

### Repository state independently checked

- `round3-development` resolves to commit `ce659f3d55ecc40f83f0f77b8062a3e19c25dfad` (confirmed by comparing the branch ref to that commit: identical).
- Comparison against `main`: **260 commits ahead, 3 behind**, merge base `67cd33b0a003c7590c12f5d18a5b2a316167a1ea`. Current `main` commit is `5f3657cffe0fada2ebb22a32814492dd1c48965c`.
- Development branch has 12 migration files; main's comparison shows 10. The development-only migration files are `20261117110000_require_atomic_owner_membership_changes.sql` and `20261118100000_membership_revocation_broadcast.sql`.
- PR #1 and #2 are merged; PR #3 remains open; PR #4 is confirmed merged. No merge or deployment was performed during this review.
- Commit status API returned no status entries for the current branch head. The connected workflow-runs tool returns only PR-triggered runs and returned no runs for this head. The last retrieved run, [#44244690750](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44244690750), failed both jobs before the latest three syntax repairs. A new post-fix CI result is **not verified**.
- The Supabase skill could not be loaded; skill discovery returned no skills. Therefore no fresh connected Supabase query was run today.

### Milestone 2 Realtime note

The current membership revocation trigger uses `realtime.send(..., private=true)` and the client subscribes to a matching private user topic. Supabase's current Broadcast documentation says a database broadcast depends on `realtime.messages` daily partitions: client WebSocket connection creates partitions; `realtime.send` does not. If no partition for the current date exists, the message insert is dropped with `WarnSendingBroadcastMessage`. This is an availability limitation for the invalidation hint, not authorization: the client must re-query membership through RLS, and all database access remains governed by RLS.

Official documentation:
- [Broadcast from the database](https://supabase.com/docs/guides/realtime/broadcast)
- [WarnSendingBroadcastMessage troubleshooting](https://supabase.com/kb/troubleshooting/realtime-warn-sending-broadcast-message)

### Current disposition

- Milestone 2 remains **OPEN — no managed Supabase compatibility/security sign-off**.
- Local SQL syntax repairs are textually present, but PostgreSQL 17 execution of the post-fix branch is not verified in this automation run.
- The prior successful PostgreSQL/CI runs predate the latest membership-revocation and syntax-repair commits and must not be reused as proof for the branch head.
- Exact branch comparison and PR status were refreshed; release gates remain as listed in the tracker.
- No hosted schema/data/Auth/Storage settings, secrets, merge, deployment, or paid resource was changed. **No user action is required today.**
## 2026-11-20 documentation correction

The M7 row and executive summary were corrected to reflect the later failed workflow run #44244690750 and the post-failure test repairs. Run #43681406630 and #43758917330 are historical green results on earlier snapshots; they do not certify the latest code. The exact branch head before this documentation correction was `0ae2ecc19ff6422a61e9d11d17c515e40d6b4003`, and the current branch comparison remains 260 ahead / 3 behind. No current CI result is available through the connected workflow-run tool.
## 2026-11-20 follow-up — OAuth startup handling on development

Code review found that the development branch's Google OAuth initiation handled returned errors but not thrown/rejected startup failures, which could leave the sign-in button in a busy state. I applied the small try/catch correction from the open PR #3 pattern directly to AuthGate on the development branch, and corrected the nearby stale comment to describe the current private per-user Broadcast (rather than the superseded unfiltered DELETE listener).

- Commit: `119e6cbf7490a594a1d26f5f137725dfe506edc7`.
- The patch was inspected through its GitHub commit diff. It clears stale messages, catches thrown OAuth errors, logs a diagnostic and restores the busy state on failure.
- PR #3 remains open and was not merged. Hosted Google OAuth configuration and end-to-end login remain unverified.
- No local test, build or browser run was possible in this automation runtime because the repository is not mounted here. GitHub status checks for the branch head are not exposed by the connected workflow-run tool.

Milestone 3 remains **in progress**. This is a code-level error-handling improvement, not live OAuth acceptance.


## 2026-11-21 review — latest branch CI failure diagnosis

### Current branch and workflow status

- Branch API confirms `round3-development` at `5fea6371332b475aceec7506119dc3d0c4fa4abf`, last pushed 2026-11-20. Branch protection is reported disabled.
- Compare against `main`: **267 ahead, 3 behind**, merge base `67cd33b0a003c7590c12f5d18a5b2a316167a1ea`.
- Latest push-triggered run on the exact branch head: [#44679254146](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44679254146), **failed both jobs**.
- Application job: 20 of 21 server tests passed. The membership Realtime test expected `private: true` at the top-level channel options, but implementation correctly passes Supabase channel options as `{ config: { private: true } }`. Type-check, build and Playwright were skipped due to test failure.
- PostgreSQL job: all migrations completed and schema output was produced. The smoke test failed at `Former owner did not receive the targeted private revocation signal`. This is distinct from the previous syntax failures and needs further diagnosis.

### Repairs prepared

- The unit-test assertion now reads the private-channel option from the nested `config.private` shape, matching the implementation and SDK channel-options contract.
- The Broadcast smoke test now first checks message recording as the disposable database owner, then checks visibility under the authenticated user's topic/RLS. This separates trigger insertion from policy filtering for better failure diagnosis; it does not relax authorization or turn a failed check into a pass.

The repairs are committed only to `round3-development`; CI will validate the new snapshot. If the privileged check fails, the trigger/stub interaction remains a blocker. If it passes and authenticated visibility fails, the local policy/Realtime-topic stub is the specific next layer to fix.

### Supabase limitation

Supabase skill discovery returned no skills and its documented skill URI returned Resource not found. No fresh connected Supabase query was run. Historical hosted reports remain inconsistent with the last independently verified empty-schema snapshot. Milestone 2 stays **OPEN — no managed compatibility/security sign-off**.

No live database/schema/data, Auth/Storage settings, secrets, merge, deployment, or paid resource was changed. No user action is required today.
