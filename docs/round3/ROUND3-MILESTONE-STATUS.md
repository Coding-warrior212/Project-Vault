# ProjectVault Round 3 — Milestone Status

**Snapshot:** 2026-11-14 (user-local verification on `375e7f2`; latest PR CI passed both jobs)  
**Repository:** `Coding-warrior212/Project-Vault`  
**Working branch:** `round3-development`  
**Target:** preserve `main` and the hosted Supabase project until explicit release approval.

## Executive status

The Round 3 branch contains the 14-table draft schema, RLS/triggers/RPCs, a local PostgreSQL 17 validation harness, a server-side invite redemption boundary, browser authentication UI, and automated CI.

The user has now pulled the latest branch head `375e7f232a100094f410e05fe4280dcb20f2be8f` and locally verified:
- `npm run test:server`: 5/5 tests passed.
- `npm run lint`: TypeScript check passed with no errors.
- `npm run build`: production build passed (1,727 modules); the main JS chunk is 973.16 KB and triggers a non-blocking Vite size warning; the PDF worker asset is 1,271.91 KB.
GitHub Actions PR run [43576454363](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43576454363) also passed both jobs: application tests/typecheck/build and disposable PostgreSQL 17 migration/adversarial smoke tests.

Milestone 3 is verified at the source/build/unit-test level, but remains in progress until real Supabase Auth, OAuth callbacks, RLS and invite redemption are exercised against a disposable Supabase runtime. The hosted Supabase project remains untouched.

No hosted migration, production data/schema change, deployment, PR merge, or secret modification has been performed.

## Eight milestone tracker

| # | Milestone | Current status | Verified progress | Remaining blockers / acceptance evidence |
|---|---|---|---|---|
| 1 | Development foundation | In progress | Branch head `375e7f2`; user-local server tests (5/5), TypeScript check, and Vite build pass; latest PR CI run `43576454363` passes both app and PostgreSQL 17 jobs; PR #1 remains draft and unmerged. | Review branch scope and address the non-blocking large JS chunk warning; complete final branch review. |
| 2 | Supabase foundation | Open — not signed off | 14-table migration and RLS/security assertions are drafted. PostgreSQL 17 local migration/adversarial smoke harness passed; invite route tests passed 5/5. Hosted project remains at zero migrations and is unchanged. Empty-schema Security/Performance/Health Advisors report no findings. | Verify managed Supabase roles, RPC ownership/grants, PostgREST transaction capabilities, Storage, Auth and Realtime on an approved disposable environment. Review advisors again after schema exists. Define file replacement semantics. |
| 3 | Authentication and RBAC | In progress — locally verified; live integration pending | Email/password registration/sign-in, Google OAuth initiation, password reset/update, session restoration, sign-out, authenticated invite redemption and RLS-backed membership portal are implemented. User-local tests 5/5, TypeScript and build pass on `375e7f2`; latest PR CI passes app and DB jobs. | Verify real Auth provider configuration and email/OAuth callbacks on a disposable Supabase stack; exercise invite redemption against real Auth/PostgREST; role-aware operations follow with cloud adapter. No hosted migration applied. |
| 4 | Cloud persistence and realtime | Not started | Local IndexedDB/localStorage remains available; draft cloud schema exists. | Implement Supabase data adapter and Storage upload/download/delete, idempotent local-to-cloud importer with orphan filtering and row-count verification, Realtime subscriptions, and preserve existing local data until verified. |
| 5 | Three promised improvements | Not complete | Draft tables include workspace collaboration and graph nodes/edges. | Connect shared workspaces to live app state; implement user-authorized GitHub repository sync; implement graph construction and evidence-linked change-impact/staleness propagation. |
| 6 | Judge Demo | Partial design only | Migration includes a seeded Apex demo workspace and policies intended to keep it read-only. | App still boots from local sample data; wire a one-click read-only demo path, prove no private-workspace visibility or mutation, and block Gemini/quota-consuming operations for demo visitors. |
| 7 | Security and end-to-end testing | Open | Local schema assertions and adversarial smoke harness exist. Invite endpoint unit/integration tests are committed. | Execute tests; test anon/authenticated/service_role, all five roles, cross-workspace isolation, invite expiry/revocation/replay/concurrency, owner safety, Storage and Realtime. Add protected Gemini route tests. |
| 8 | Final deployment and submission | Not ready | Existing app and repository links are recorded in project context. | Only after gates pass: controlled deployment, production migration approval, end-to-end smoke test, updated project PDF, improvements list, technical details, testing notes and team contributions. |

## New branch work in this snapshot

- `.github/workflows/round3-verification.yml` (commit `eacbf15`): runs Node 22 locked install, invite server tests, TypeScript lint, Vite production build, and the disposable PostgreSQL 17 migration/assertion/adversarial smoke harness. GitHub Actions run `43573429135` completed successfully; both jobs and all listed steps passed.

- `server/supabaseInvite.ts`: dedicated small-body invite route; Supabase Auth user validation; explicit non-anonymous check; SHA-256 invite hash; service-only RPC call using the secret key on the `apikey` header; bounded per-IP in-memory limiter; request timeouts; sanitized errors.
- `server/supabaseInvite.test.ts`: code normalization/hash, authenticated identity derivation, no secret Bearer header, anonymous-user rejection and missing-session tests.
- `server.ts`: mounts the invite router before the large-document JSON parser and trusts the single Render proxy hop for client-IP rate limiting.
- `package.json`: adds `npm run test:server`.
- Migration RPC: fixes retry idempotency at the final invite-use boundary; local SQL smoke test now checks that a repeated redemption by the same user returns the existing membership and does not increment the counter twice.
- `.env.example`: documents `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY`.

The invite endpoint behavior is locally verified by the 5-test suite. The production route is not yet wired to a sign-in/invite UI or validated against a real Supabase Auth/PostgREST environment.

## Latest local checkout confirmation

The user pulled `origin/round3-development` successfully from `7426dc4` to `2734c4d` using a fast-forward update. No conflicts were reported. The user's earlier local verification passed server tests 5/5, lint, production build, and the local PostgreSQL 17 migration/smoke harness. On `4897a27`, tests still passed but lint failed with 14 errors; commit `b8f43be` removes the unreachable legacy Gemini implementation. Re-run server tests, lint, build and local PostgreSQL harness after pulling that commit. This is local-only validation; do not connect the test command to the hosted Supabase project.

No Supabase secrets are needed for these local tests. Do not add a real secret key to Git, `.env.example`, Vite-prefixed variables, or the browser bundle.

## Security gates that remain explicit

- The Gemini extraction/conflict endpoints in `server.ts` have now been changed to fail closed with HTTP 503 until verified sessions and workspace authorization are integrated; the status endpoint no longer discloses whether a provider secret is configured. This deliberately disables AI extraction/conflict analysis in the current unauthenticated client rather than expose Gemini quota. It is an interim mitigation, not the completed authorization implementation; add protected, workspace-scoped routes and negative tests before re-enabling AI. The app also has no Supabase Auth UI or cloud persistence adapter, so the SQL migration is not yet an integrated production application. Do not present the current hosted app as a secure multi-tenant deployment until session verification, workspace contributor authorization, frontend session wiring, and negative tests are complete.
- Storage UPDATE is deliberately denied. Same-key upsert/replacement is unsupported until a constrained update policy is designed and tested; keep the current fail-closed policy meanwhile.
- The local PostgreSQL stubs do not prove Supabase-managed Auth, PostgREST, Storage, Realtime, key handling, or role behavior.
- The hosted project must remain unchanged until the disposable-environment gates pass and a separate explicit production approval is given.

## Free-only and release constraints

Use only zero-cost local tooling and existing free allowances. Do not introduce paid infrastructure, apply migrations to production, alter live data/schema, deploy, merge PRs, or change secrets without explicit approval.


## Latest security hardening (commit `5071eec`)

- Removed the provider-secret presence disclosure from `GET /api/gemini/status`; it now reports the AI capability as unavailable without exposing secret configuration.
- Changed both Gemini POST endpoints to fail closed with a clear `WORKSPACE_AUTHORIZATION_REQUIRED` response until the application has authenticated sessions and server-verified workspace membership.
- This is intentionally a temporary availability trade-off: current frontend calls do not carry authenticated session/workspace context. Do not re-enable these endpoints merely by adding a bearer-header presence check; verify the token with Supabase Auth and authorize the requested workspace/source server-side first.
- Latest security commit still requires CI and local WSL verification. No production resources were touched.


## Follow-up cleanup (commit `b8f43be`)

- Removed the unreachable legacy Gemini extraction and conflict-analysis implementations and their unused SDK/schema/helper code. This resolves the source of the TypeScript errors without weakening the fail-closed behavior.
- Both Gemini POST endpoints still return HTTP 503 with `WORKSPACE_AUTHORIZATION_REQUIRED`; no Gemini calls or quota use can occur through these routes until verified session and workspace authorization are implemented.
- The user's verification of `4897a27` reported 14 TypeScript errors in the unreachable legacy code. Server invite tests passed 5/5 and Vite build completed. Pull and re-run checks on `b8f43be`; no local pass is claimed yet.


## Judge-facing AI availability disclosure (commit `bdc60e6`)

- Updated the reconstruction modal to clearly state that AI reconstruction is temporarily unavailable until authenticated workspace authorization is implemented. The extraction action is visibly disabled rather than inviting users to submit documents to a route that correctly fails closed.
- Existing knowledge review remains available. This is a user-experience honesty improvement, not completion of the AI/authentication milestone. Commit `bdc60e6` awaits local and CI verification.

## Milestone 3 implementation update (2026-11-14)

The branch now contains the first integrated browser authentication and workspace-access gate:

- `src/lib/supabase.ts` creates a browser Supabase client only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. HTTPS is required except for localhost HTTP development URLs. The browser client never imports or exposes the server secret key.
- `src/components/auth/AuthGate.tsx` restores persisted sessions, subscribes to Auth state changes, supports email/password sign-in and registration, Google OAuth, password reset, and sign-out.
- The authenticated workspace portal queries `workspace_members` filtered to the current Auth user, then retrieves only those workspace records. Database RLS remains the actual authorization boundary; client-side filtering is not treated as security.
- The portal redeems invitation codes through the existing `/api/workspaces/redeem-invite` endpoint using the current access token. The server validates the token with Supabase Auth and derives the user ID itself.
- `src/main.tsx` mounts the gate. If browser Supabase configuration is absent, the existing sample UI remains available with a visible local-demo-mode banner; no private workspace is loaded in this fallback.
- `.env.example` now documents the two browser-safe `VITE_` variables separately from server-only `SUPABASE_SECRET_KEY`.

**Important scope boundary:** Once Auth is configured, the authenticated portal intentionally does not mount the old sample-data application for private workspaces. The existing project screens still use local demo state and must not be mistaken for a cloud-backed private workspace. The portal reports verified membership and role only; loading private records belongs to Milestone 4.

**Verification:** GitHub Actions application job for commit `5fdc270` passed server tests, TypeScript typecheck and Vite production build. The pull-request PostgreSQL job failed while starting the disposable Docker-based validation container (after pulling `postgres:17-alpine`); the failure occurred before migration output and is not evidence of a SQL assertion failure. The earlier user-run local PostgreSQL 17 migration/adversarial harness remains the latest successful database validation. Re-run the database workflow before signing off this milestone. The push-triggered workflow run is pending at this snapshot.

**Not yet verified:** live Supabase Auth provider configuration, Google OAuth callback configuration, email confirmation/reset delivery, PostgREST RLS behavior on the managed project, actual invitation redemption against managed Auth/PostgREST, and the full sign-up → invite → workspace membership flow. No production migration or secret change was made.



## Milestone 3 verification follow-up (2026-11-14, commit `65aa8ea`)

- Added password-recovery callback handling and an authenticated password-update form.
- Hardened browser configuration detection to reject placeholder values and permit HTTP only for localhost Supabase development; deployed Supabase URLs must use HTTPS.
- GitHub Actions PR run `43576399121` passed both jobs: server tests, TypeScript typecheck, Vite production build, and local PostgreSQL 17 migration/adversarial smoke tests.
- The browser client uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The service/secret key remains server-only. Supabase Auth persists and refreshes sessions using the SDK; authorization of workspace rows is still enforced by database RLS.
- The authenticated portal intentionally stops at verified workspace membership metadata. It does not claim that private workspace source/claim records are cloud-loaded. That integration is Milestone 4.
- Live Auth provider configuration, email delivery, Google OAuth callback, actual managed Supabase RLS, and real invite redemption remain unverified. The hosted Supabase project has not been changed. Do not mark Milestone 3 complete until disposable Supabase runtime tests pass.


## Latest user verification — 2026-11-14

The user pulled `origin/round3-development` from `0cdc317` to `375e7f2` with a clean fast-forward update, then ran the following successfully from WSL:
- `npm run test:server`: 5 passed, 0 failed.
- `npm run lint`: `tsc --noEmit` passed.
- `npm run build`: Vite production build passed (1,727 modules). Non-blocking warnings: main JS chunk 973.16 KB exceeds 500 KB; PDF worker asset is 1,271.91 KB.

GitHub Actions PR run `43576454363` for the same branch head completed successfully. Both jobs passed, including the PostgreSQL 17 migration and adversarial smoke harness.

PR #1 remains open, draft and unmerged. The branch is 76 commits ahead of `main`, with no commits behind. Keep `main`, the hosted Supabase project, deployment settings and secrets unchanged. Next integration gate is a disposable local Supabase CLI stack (Auth + PostgREST + Storage + Realtime), not the hosted project.
