# ProjectVault Round 3 — Milestone Status

**Snapshot:** 2026-11-14 (local validation and GitHub Actions CI confirmed)  
**Repository:** `Coding-warrior212/Project-Vault`  
**Working branch:** `round3-development`  
**Target:** preserve `main` and the hosted Supabase project until explicit release approval.

## Executive status

The Round 3 branch contains the 14-table draft schema, RLS/triggers/RPCs, a local PostgreSQL 17 validation harness, a server-side invite redemption boundary, and automated CI. The latest workflow run for commit `2734c4d` completed successfully: both the application checks and PostgreSQL 17 migration/adversarial smoke-test jobs passed.

The local PostgreSQL 17 migration and adversarial smoke harness has passed after the invite-replay SQL regression fix (user-reported terminal output). The server invite suite passed 5/5; TypeScript lint (`tsc --noEmit`) passed; and the Vite production build completed successfully (1,681 modules). The build emitted non-blocking warnings for `__dirname` compatibility with Vite's future native config loader and a JavaScript chunk above 500 KB. The connected Supabase project is active on PostgreSQL 17 but reports zero applied migrations; Security, Performance and Health Advisors currently return no findings on the empty schema. Those empty-schema results are not evidence that the proposed schema is secure.

No hosted migration, production data/schema change, deployment, PR merge, or secret modification has been performed.

## Eight milestone tracker

| # | Milestone | Current status | Verified progress | Remaining blockers / acceptance evidence |
|---|---|---|---|---|
| 1 | Development foundation | In progress | `round3-development` exists; draft PR #1 remains unmerged; local server tests (5/5), TypeScript lint, Vite build, and PostgreSQL 17 migration smoke tests pass on the user's WSL machine. GitHub Actions run for `2734c4d` passed both CI jobs. | Review remaining branch diff and resolve non-blocking Vite config/chunk warnings when safely justified. |
| 2 | Supabase foundation | Open — not signed off | 14-table migration and RLS/security assertions are drafted. PostgreSQL 17 local migration/adversarial smoke harness passed; invite route tests passed 5/5. Hosted project remains at zero migrations and is unchanged. Empty-schema Security/Performance/Health Advisors report no findings. | Verify managed Supabase roles, RPC ownership/grants, PostgREST transaction capabilities, Storage, Auth and Realtime on an approved disposable environment. Review advisors again after schema exists. Define file replacement semantics. |
| 3 | Authentication and RBAC | In progress — not complete | Five-role policy model and service-role-only invite RPC are in the draft migration. Invite route validates the user through Supabase Auth, rejects anonymous users, derives the user ID from Auth, hashes codes server-side and calls the RPC with the server-only secret key. | Add frontend Email/Password + Google Auth, session lifecycle, profile/workspace loading, invite creation/revocation APIs and UI, and full role-based route guards. Execute tests. |
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

The user pulled `origin/round3-development` successfully from `7426dc4` to `2734c4d` using a fast-forward update. No conflicts were reported. The user's earlier local verification passed: server tests 5/5, lint, production build, and local PostgreSQL 17 migration/smoke harness. Re-run the same checks after subsequent code changes. This is local-only validation; do not connect the test command to the hosted Supabase project.

No Supabase secrets are needed for these local tests. Do not add a real secret key to Git, `.env.example`, Vite-prefixed variables, or the browser bundle.

## Security gates that remain explicit

- The Gemini extraction/conflict endpoints in `server.ts` still accept requests without a verified Supabase session or workspace authorization; the current frontend calls them without an auth token. This exposes server-side Gemini quota and is a release-blocking security issue. The app also has no Supabase Auth UI or cloud persistence adapter, so the SQL migration is not yet an integrated production application. Do not present the current hosted app as a secure multi-tenant deployment until session verification, workspace contributor authorization, frontend session wiring, and negative tests are complete.
- Storage UPDATE is deliberately denied. Same-key upsert/replacement is unsupported until a constrained update policy is designed and tested; keep the current fail-closed policy meanwhile.
- The local PostgreSQL stubs do not prove Supabase-managed Auth, PostgREST, Storage, Realtime, key handling, or role behavior.
- The hosted project must remain unchanged until the disposable-environment gates pass and a separate explicit production approval is given.

## Free-only and release constraints

Use only zero-cost local tooling and existing free allowances. Do not introduce paid infrastructure, apply migrations to production, alter live data/schema, deploy, merge PRs, or change secrets without explicit approval.
