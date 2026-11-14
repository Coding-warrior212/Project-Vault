# ProjectVault Round 3 — Milestone Status

**Snapshot:** 2026-11-14  
**Repository:** `Coding-warrior212/Project-Vault`  
**Working branch:** `round3-development`  
**Target:** preserve `main` and the hosted Supabase project until explicit release approval.

## Executive status

The Round 3 branch is **40 commits ahead of `main` and 0 behind** at this snapshot. The branch contains the 14-table draft schema, RLS/triggers/RPCs, a local PostgreSQL 17 validation harness, and a new server-side invite redemption boundary.

The user previously ran the local PostgreSQL 17 harness successfully. That PASS predates the latest invite-replay SQL regression and must be repeated. The connected Supabase project currently reports zero migrations and zero tables in `public`/`private`; its empty-schema Security Advisor result is not evidence that the proposed schema is secure.

No hosted migration, production data/schema change, deployment, PR merge, or secret modification has been performed.

## Eight milestone tracker

| # | Milestone | Current status | Verified progress | Remaining blockers / acceptance evidence |
|---|---|---|---|---|
| 1 | Development foundation | In progress | `round3-development` exists; draft PR #1 remains unmerged; schema review, local validation scripts and documentation are committed. | Complete repository build/type checks, review branch diff and retain a clean reproducible baseline. |
| 2 | Supabase foundation | Open — not signed off | 14-table migration and RLS/security assertions are drafted. PostgreSQL 17 local harness passed before the latest SQL regression. Server invite redemption route and focused tests are committed. | Re-run local SQL and Node tests; verify managed Supabase roles, RPC ownership/grants, PostgREST transaction capabilities, Storage, Auth, Realtime and all advisors on an approved disposable environment. Define file replacement semantics. |
| 3 | Authentication and RBAC | In progress — not complete | Five-role policy model and service-role-only invite RPC are in the draft migration. Invite route validates the user through Supabase Auth, rejects anonymous users, derives the user ID from Auth, hashes codes server-side and calls the RPC with the server-only secret key. | Add frontend Email/Password + Google Auth, session lifecycle, profile/workspace loading, invite creation/revocation APIs and UI, and full role-based route guards. Execute tests. |
| 4 | Cloud persistence and realtime | Not started | Local IndexedDB/localStorage remains available; draft cloud schema exists. | Implement Supabase data adapter and Storage upload/download/delete, idempotent local-to-cloud importer with orphan filtering and row-count verification, Realtime subscriptions, and preserve existing local data until verified. |
| 5 | Three promised improvements | Not complete | Draft tables include workspace collaboration and graph nodes/edges. | Connect shared workspaces to live app state; implement user-authorized GitHub repository sync; implement graph construction and evidence-linked change-impact/staleness propagation. |
| 6 | Judge Demo | Partial design only | Migration includes a seeded Apex demo workspace and policies intended to keep it read-only. | App still boots from local sample data; wire a one-click read-only demo path, prove no private-workspace visibility or mutation, and block Gemini/quota-consuming operations for demo visitors. |
| 7 | Security and end-to-end testing | Open | Local schema assertions and adversarial smoke harness exist. Invite endpoint unit/integration tests are committed. | Execute tests; test anon/authenticated/service_role, all five roles, cross-workspace isolation, invite expiry/revocation/replay/concurrency, owner safety, Storage and Realtime. Add protected Gemini route tests. |
| 8 | Final deployment and submission | Not ready | Existing app and repository links are recorded in project context. | Only after gates pass: controlled deployment, production migration approval, end-to-end smoke test, updated project PDF, improvements list, technical details, testing notes and team contributions. |

## New branch work in this snapshot

- `server/supabaseInvite.ts`: dedicated small-body invite route; Supabase Auth user validation; explicit non-anonymous check; SHA-256 invite hash; service-only RPC call using the secret key on the `apikey` header; bounded per-IP in-memory limiter; request timeouts; sanitized errors.
- `server/supabaseInvite.test.ts`: code normalization/hash, authenticated identity derivation, no secret Bearer header, anonymous-user rejection and missing-session tests.
- `server.ts`: mounts the invite router before the large-document JSON parser and trusts the single Render proxy hop for client-IP rate limiting.
- `package.json`: adds `npm run test:server`.
- Migration RPC: fixes retry idempotency at the final invite-use boundary; local SQL smoke test now checks that a repeated redemption by the same user returns the existing membership and does not increment the counter twice.
- `.env.example`: documents `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY`.

These changes are **committed but not yet runtime-verified** in this environment.

## Immediate user action needed

The latest SQL and Node tests cannot be executed from this remote repository review session. On the user's Ubuntu WSL terminal, in the cloned repository:

```bash
git switch round3-development
git pull origin round3-development
npm ci
npm run test:server
npm run lint
npm run build
bash scripts/validate-db-local.sh
```

Send the complete output, especially any failing test or TypeScript error. This is local-only validation; do not connect the test command to the hosted Supabase project.

No Supabase secrets are needed for these local tests. Do not add a real secret key to Git, `.env.example`, Vite-prefixed variables, or the browser bundle.

## Security gates that remain explicit

- The existing Gemini extraction/conflict endpoints are not yet protected by the new authentication boundary. Do not treat the current hosted app as a multi-tenant secure deployment until this is fixed and verified.
- The app still has no Supabase Auth UI or cloud persistence adapter; the SQL migration is not yet an integrated production application.
- Storage UPDATE is deliberately denied. Same-key upsert/replacement is unsupported until a constrained update policy is designed and tested; keep the current fail-closed policy meanwhile.
- The local PostgreSQL stubs do not prove Supabase-managed Auth, PostgREST, Storage, Realtime, key handling, or role behavior.
- The hosted project must remain unchanged until the disposable-environment gates pass and a separate explicit production approval is given.

## Free-only and release constraints

Use only zero-cost local tooling and existing free allowances. Do not introduce paid infrastructure, apply migrations to production, alter live data/schema, deploy, merge PRs, or change secrets without explicit approval.
