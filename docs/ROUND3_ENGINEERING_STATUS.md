# ProjectVault — Round 3 Engineering Status

**Team:** CYBERYODDHA  
**Tagline:** Knowledge that stays. Projects that move.  
**Working branch:** `round3-development`  
**Pull requests:** #1 and #2 are closed; main has corresponding web-flow commits. The development branch remains separate and diverged; reconcile squash-merge history before any reset/rebase.

## Implemented in the current branch

### 1. Authenticated workspace access
- AuthGate verifies the signed-in Supabase user and reads only their workspace memberships.
- Users choose an authorized workspace before the project application mounts.
- Switching workspaces unmounts the previous workspace view; sign-out or revoked membership clears the selection.
- Authenticated workspace state starts empty, so browser demo records are not merged into team data.

### 2. Workspace-scoped cloud persistence
- Sources, claims, conflicts, missing-information findings, questions, activity events, and handover records are loaded from Supabase using the active workspace ID.
- Browser writes remain available only in the unconfigured local demo mode.
- Claim review uses an update-only path so reviewers do not need insert privileges.
- Workspace data is refreshed when subscribed Postgres changes arrive.

### 3. Private source-file storage
- Uploaded source files are stored in the private `projectvault-sources` bucket.
- Metadata records are tied to the same workspace and source.
- Downloads use short-lived signed URLs.
- Source deletion removes stored objects before deleting source metadata.
- Upload failure cleanup avoids leaving a source row without its initial file.

### 4. Public GitHub documentation snapshots
- Users can connect a public GitHub repository URL and optionally choose a branch.
- ProjectVault records the commit SHA and snapshots the README plus up to seven Markdown/text documentation files.
- A **Sync latest** action fetches the latest branch commit and updates the snapshot.
- Private repositories and automatic background sync are intentionally not supported in this version; no personal access token is requested or exposed.

### 5. Knowledge graph and change-impact view
- The new Knowledge Graph page maps sources to their evidence-linked claims.
- Selecting a source shows linked claims, verification counts, flagged claims, and open conflicts involving those claims.
- This is a live view derived from workspace source/claim records; it is not yet a persisted dependency graph or automated code-impact analyser.

### 6. Human-approved handover
- Handover drafts and approvals can be loaded and saved per workspace.
- Approval state is updated only after the save succeeds.
- The handover page listens for workspace realtime changes.
- Viewer access remains constrained by database RLS.

### 7. Interactive Judge Demo
- Judges can enter from the sign-in screen or workspace-access portal without joining or changing a team workspace.
- The demo renders the normal interactive application for the currently implemented workflows; it is not a read-only preview.
- Demo source files, claims, review state, and handover notes use a separate browser-local IndexedDB database, localStorage key namespace, and in-memory fallback.
- Reset clears only the Judge Demo namespace. It surfaces an error if the isolated IndexedDB database cannot be cleared; Exit Demo returns to the normal local storage scope.
- The app's sample data is reloaded when the demo is entered again after reset.
- Browser verification completed for the interactive Judge Demo path: entering the demo, adding a user source, exercising claim review/conflict resolution/missing-info/question workflows, generating and approving a handover, copying/downloading the dossier, refreshing persisted demo changes, and resetting back to the original sample dataset. The reset regression was reproduced (a user-added Fastify source survived the old reset), fixed, pulled locally, and re-tested successfully; the user confirmed the post-fix reset passed. Preservation of unrelated pre-existing default-scope browser records remains a separate isolation check.

## Security design
- Browser code uses only the Supabase publishable key.
- The Supabase secret/service-role key is never exposed through a `VITE_` variable.
- Data access depends on the database RLS policies and the authenticated user's JWT.
- The app does not import local demo records into authenticated workspaces.
- Gemini extraction and conflict-analysis routes validate the Supabase user session, require an explicitly non-anonymous identity, check workspace membership with the user's JWT/RLS, and enforce route-specific roles. The routes fetch source/claim data with the user's JWT. Live managed-backend behavior and Gemini key availability remain unverified.

## Verification evidence

The latest completed GitHub Actions verification on the isolated Judge Demo namespace commit passed (run #43620652179):
- Server security and storage-namespace tests: **10/10**
- TypeScript type-check: **pass**
- Vite production build: **pass**
- Disposable PostgreSQL 17 migration, schema assertions, and adversarial smoke tests: **pass**

The local Supabase Auth lifecycle test previously passed signup, password login, session identity verification, and disposable account cleanup. The local RBAC runtime test previously passed 23 checks covering workspace creation, invite redemption, role enforcement, and outsider isolation.

## Not yet verified / remaining release gates
- The new browser cloud adapter, file upload/download, handover UI, realtime behavior, and GitHub sync still require a full end-to-end run against the local Supabase stack after pulling this branch.
- The last independently verified hosted Supabase snapshot (2026-11-15) was empty. Later PR/release notes report eleven hosted migrations and fourteen tables. The current run could not recheck the connected project; hosted state is unresolved and must not be described as either empty or migrated without a fresh read-only check.
- Google OAuth provider configuration has not been verified in the Supabase dashboard.
- AI route authorization is implemented in code; dedicated negative route tests and managed Supabase/Gemini end-to-end verification remain outstanding.
- The interactive judge demo's entry, supported review/handover interactions, refresh persistence, and reset-to-seed behavior have now passed browser checks. A separate browser check that pre-existing default-scope records remain unchanged across entering/exiting/resetting Judge Demo is still open.
- GitHub private-repository OAuth and scheduled/background sync are not included.
- The knowledge graph is source-to-claim evidence tracing, not full graph-node/edge persistence or automatic dependency propagation.
- This audit did not deploy, merge, or apply hosted migrations. PR #1/#2 are closed; the release draft reports a Render deployment, but current deployment state was not independently verified. Final PDF and actual submission state are not verified here.

## Team contribution record
Do not infer individual contributions. Confirm each member's actual work before completing the submission contribution section:
- Ruchita Shinde
- Abhijit Gadade
- Sanmay Dalvi
- Saksham Singh


## 2026-11-15 automation review

- Rechecked the connected hosted Supabase project read-only: PostgreSQL 17.11, `supabase_realtime` publication present, zero application tables and zero migration history rows. No schema/data/Auth/Storage/secret/deployment settings were changed.
- Found that the previous local validation script applied only the first migration. It now applies all SQL migrations in lexical order. GitHub Actions run [#43681066786](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43681066786) passed both jobs, including the complete migration set and schema assertions.
- Hardened append-only activity references: the second migration drops source, claim and actor-user `ON DELETE SET NULL` foreign keys and adds same-workspace insert-time validation. Added Realtime subscription to `activity_events`.
- Commit `47b085b` adds negative local smoke checks for cross-workspace activity references and preservation of audit references after source/claim deletion. A CI result for this latest smoke-test commit is not yet confirmed.
- Milestone 2 remains open because managed Supabase/PostgREST/Auth/Storage/Realtime behavior and the complete role/concurrency matrix are not verified. The Judge Demo remains interactive and local-only, not strictly read-only as originally agreed. Gemini endpoints remain fail-closed until secure workspace authorization is implemented.
- No deployment, PR merge, production migration, secret modification, or paid infrastructure was used.


### CI follow-up — 2026-11-15

GitHub Actions run [#43681406630](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43681406630) completed successfully:
- Server tests, TypeScript typecheck and production build: pass.
- PostgreSQL 17 job: pass after applying every migration file, including the append-only activity-reference migration, running the updated schema assertions, and executing the cross-workspace reference/source-deletion smoke checks.

Commit `c7bd137` removes a global JSON parser from the invite-router test setup so the route's own 2 KB limit is tested, and adds an oversized-body 413 test. Both application and database CI jobs passed on the resulting branch snapshot. The application route is mounted before the global 35 MB parser in `server.ts`.

## Automation review — 2026-11-16 (latest)

- PR #1 and #2 are closed. The review APIs returned no submitted review records or inline review threads.
- GitHub Actions run [#43813310350](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43813310350) passed both jobs on the current branch head: server tests, typecheck, production build, Playwright E2E, all SQL migrations on disposable PostgreSQL 17, schema assertions, and adversarial smoke tests.
- Fixed Render invite throttling's default client identity: when `RENDER=true`, use a syntactically validated `CF-Connecting-IP` unless explicitly disabled by `PROJECTVAULT_TRUST_CF_CONNECTING_IP=false`; never use caller-controlled `X-Forwarded-For`. Regression is included in run #43813310350. The limiter remains process-local/in-memory.
- Owner lifecycle mitigation committed in `20261117110000_require_atomic_owner_membership_changes.sql`: direct owner deletion is denied by RLS and the membership trigger; owner changes must use the capability-gated atomic transfer RPC. New local assertions/smoke tests are pending CI and do not replace managed concurrency validation.
- New session-staleness risk: AuthGate does not subscribe to workspace_members changes. Revocation while the app is open may leave active selection and loaded client data visible until refresh, though RLS should deny later database requests. Add a revocation E2E test and state-clearing behavior.
- Hosted Supabase rechecked read-only: PostgreSQL 17.11, Realtime publication present, zero app tables, zero migration records, no Security/Performance/Health advisor lints on the empty schema. No hosted changes made.
- Milestone 2 remains open. No production migration, deployment, merge, secret change, or paid service was used.


## 2026-11-17 branch audit addendum

- Development branch start-of-review head: `7d0360f8f949ae27bba40b0c1afc6450eef8a260`; main: `d8e6452dbd656983e6c73a7349a3106345e4be37`. PR #1 and #2 are closed. The branch refs compare as diverged; do not force-reset/rebase without reconciling squash-merge history.
- The development branch now includes the main AuthGate membership-revocation fix, a ProjectVault-specific README, a final submission readiness draft, the owner-membership guard migration and tests, and a strict non-anonymous Gemini identity guard/unit test.
- The branch-head CI run #43813583777 passed before these new changes. A fresh run is required for the current branch tip.
- Repository had ten migration files at the start of this review. PR #1 release notes report eleven hosted migrations, including an extra security-permissions migration not identifiable in the original ten. The new owner-guard migration added in this review is not that reported migration. Current hosted migration history is unverified.
- The last hosted read-only snapshot was 2026-11-15 and reported an empty schema; later release notes report a populated schema. Supabase skill discovery returned no available skill in this run, so the live project was not queried. Do not infer current hosted state.
- No hosted database, Auth, Storage, secret, deployment, merge or paid infrastructure action was performed.

## 2026-11-17 follow-up — owner guard and full CI verified

- Current development head before this documentation update: `08369cbe56ad5b9a790b6bcf16ac3945b50f11cd`.
- CI run [#44028139080](https://github.com/Coding-warrior212/Project-Vault/actions/runs/44028139080) completed successfully on that head. Both jobs passed: server security tests, TypeScript type-check, Vite production build, Playwright browser E2E, and all eleven repository SQL migrations plus schema assertions/adversarial smoke tests on disposable PostgreSQL 17.
- The first two runs after the owner-guard change exposed test defects, not a failing application path: single-dollar `DO $` delimiters caused a SQL parse error; after correcting those, the former-owner smoke test queried the new owner's row while still running under the former owner's RLS context. The test now resets the role before inspecting final membership state. The latest full CI run passed.
- The owner-guard migration `20261117110000_require_atomic_owner_membership_changes.sql` blocks direct owner membership deletion through both RLS and a trigger. Ownership transfer remains capability-gated and locks workspace membership rows in deterministic order. Local tests now verify direct-delete denial, atomic transfer, and former-owner departure. A managed two-session/PostgREST concurrency test remains open.
- AuthGate already subscribes to the current user's `workspace_members` changes and clears the active workspace when membership lookup returns no access or fails. This corrects the earlier static finding that no membership subscription existed. Actual managed Realtime DELETE delivery is still unverified.
- Source uploads use a UUID object path and `upsert: false`; replacement is a new object key. The Storage UPDATE policy remains denied, which is compatible with this implemented path. Real managed Storage behavior and cleanup failure handling remain unverified.
- Render read-only state: the `Project-Vault` service is on the free plan, auto-deploys from `main`, and its latest listed deployment is `live` at commit `d8e6452dbd656983e6c73a7349a3106345e4be37` (2026-11-16). The development branch is not the deployed branch.
- PR #1 and PR #2 are both merged into `main` (2026-11-16). These merges occurred outside this automation run; this automation did not merge, deploy, or change production. The long-running development branch remains graph-diverged because of the squash-merge history; do not force-reset or rebase it casually.
- GitHub reports the development branch as unprotected. Required CI checks are not enforced by branch protection; no repository settings were changed.
- The repository now contains eleven migration files. PR/release documentation reports eleven hosted migrations and fourteen public tables, but the current hosted state could not be rechecked because the Supabase skill is unavailable in the connected skill registry. The last independently verified read-only snapshot remains 2026-11-15 (empty application schema). Do not treat later hosted-state claims as independently verified.
- No hosted database, Auth, Storage, secrets, deployment, merge, or paid infrastructure action was performed in this review.

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
