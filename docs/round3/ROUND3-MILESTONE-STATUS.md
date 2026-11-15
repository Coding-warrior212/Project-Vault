# ProjectVault Round 3 — Milestone Status

**Snapshot:** 2026-11-15
**Repository:** `Coding-warrior212/Project-Vault`  
**Working branch:** `round3-development`  
**Release constraints:** free-only; preserve `main` and the hosted Supabase project until explicit release approval.

## Executive status

The development branch has advanced beyond the earlier authentication-only snapshot. It now contains browser Supabase Auth UI, a workspace-scoped cloud data adapter, private Storage upload/download/delete paths, public GitHub documentation snapshots, a derived source-to-claim knowledge graph view, and an isolated browser-local Judge Demo.

**No milestone is fully signed off overall yet.** The Judge Demo acceptance decision is resolved and its browser isolation regression now passes in CI: interactive local edits, default-workspace preservation through entry/exit/reset, and no Supabase write requests during the tested demo flow. Managed Supabase and the other release gates remain open. The hosted Supabase project remains empty and unchanged. The earlier GitHub Actions run [#43620652179](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43620652179) passed, but its database runner applied only migration 1. This review corrected the gap. GitHub Actions run [#43681406630](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43681406630) passed both jobs: server security tests, TypeScript typecheck, production build, and the PostgreSQL 17 harness applying every migration file plus schema assertions and activity-reference smoke tests. The run includes commit `c7bd137`, which adjusts the invite-router tests to exercise the route's own 2 KB body limit and verifies oversized payloads are rejected before any Supabase call.

## Eight-milestone tracker

| # | Milestone | Current status | Verified progress | Remaining blockers / acceptance evidence |
|---|---|---|---|---|
| 1 | Development foundation | In progress | `round3-development` exists and compares as ahead of `main` and 0 behind. Latest confirmed branch CI run #43681406630 passed both jobs. PR #1 is confirmed open, draft and unmerged, with 43 changed files in the current PR snapshot. The PR description was refreshed with the latest verification evidence and remaining gates. | Complete a full branch review, confirm the current PR head/status, review CI on the latest commit, and resolve the non-blocking large production-bundle warning. |
| 2 | Supabase foundation | **Open — not signed off** | Draft 14-table schema, RLS, policies, triggers, RPCs, private Storage bucket, demo seed and assertions exist. Run #43681406630 passed the local PostgreSQL 17 harness after it was changed to apply all migrations in lexical order, including the append-only activity-reference smoke checks. Migration 2 now removes all three append-only-incompatible `ON DELETE SET NULL` references (source, claim and Auth user) and validates new source/claim references at insert time. Read-only hosted checks show PostgreSQL 17.11, `supabase_realtime` publication present, zero app tables, zero migration records and no advisor lints on the empty schema. | Managed Supabase roles/function ownership, PostgREST transaction-bound capability behavior, RLS/API role tests, Storage, Auth, Realtime, concurrency, and advisors after schema installation remain unverified. The hosted project must remain unchanged. The hosted managed-Supabase gates remain open. Latest smoke-test additions for cross-workspace activity references and immutable historical references are committed but await a confirmed CI result. |
| 3 | Authentication and RBAC | In progress — implementation present, managed runtime pending | Browser client uses publishable key only. AuthGate includes email/password sign-up/sign-in, Google OAuth initiation, password recovery/update, session restoration, sign-out, workspace membership lookup, workspace creation RPC and invite redemption. Server invite route validates the session through Supabase Auth and derives the user ID from the Auth response. | Verify real email confirmation/reset delivery, Google provider and callback configuration, invite redemption against managed Auth/PostgREST, all five roles and outsider isolation. Do not put the secret key in browser variables. |
| 4 | Cloud persistence and Realtime | Partially implemented; end-to-end sign-off pending | `workspaceCloud.ts` loads/saves sources, claims, conflicts, missing-info findings, questions and activity events; it has private-bucket file operations, signed downloads, handover persistence and Realtime subscriptions. App selects cloud persistence only inside an authenticated workspace. | Full local-Supabase E2E is still required. A verified local-to-cloud importer with orphan filtering, row-count verification and a non-destructive preservation check is not present in the reviewed code. Realtime now subscribes to `activity_events` as well as the other workspace tables; build/typecheck passed in run #43681066786. |
| 5 | Three promised improvements | Partial | Shared workspace access/invite foundation exists. Public GitHub repositories can be snapshotted and manually synced to a pinned commit. The Knowledge Graph page shows source-to-claim evidence links and related review state. | GitHub private-repo OAuth/background sync is absent. The graph is a derived evidence view, not persisted graph-node/edge construction or automatic dependency/change-impact/staleness propagation. Complete and test the promised depth or explicitly scope the submission claims. |
| 6 | Judge Demo | Interactive local demo isolation verified; milestone acceptance met | Product acceptance is explicitly **interactive**, not read-only. New Playwright browser E2E test passes in CI: seeds default localStorage and IndexedDB records, enters the demo, verifies a claim-review decision persists under the demo namespace, uploads a source into the separate demo database, exits, re-enters and resets. Default workspace records remain byte-for-byte unchanged after exit and reset; demo IndexedDB/localStorage data is cleared; no write requests reach Supabase/test backend hosts. Gemini endpoints remain fail-closed. | Keep this isolation test in CI and do not describe the demo as read-only. This verifies the tested browser flow; it is not a substitute for managed Supabase or full application security testing. |
| 7 | Security and end-to-end testing | Open — local CI strengthened | Latest GitHub Actions run #43758917330 passed server security tests, typecheck, production build, all four Playwright browser E2E tests (including Judge Demo storage isolation), and the full local PostgreSQL 17 migration/assertion/adversarial smoke harness. Gemini endpoints remain fail-closed with HTTP 503 until workspace authorization exists. | Run the full test matrix against a local Supabase stack: anon/authenticated/service_role, owner/admin/editor/reviewer/viewer, cross-workspace isolation, invite expiry/revocation/replay/concurrency, last-owner races, Storage and Realtime. Add protected Gemini route tests before re-enabling AI. Local PostgreSQL is not managed Supabase validation. |
| 8 | Final deployment and submission | Not ready | Existing app and repository links are known. No deployment or production migration was performed. | Only after gates pass: separately approved production migration/deployment, end-to-end smoke test, updated project PDF, improvements list, technical details, testing notes and verified individual team contributions. |

## Current hosted Supabase baseline — read-only

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
- Never deploy, merge PR #1, change secrets, or modify live schema/data in this workflow.
- Keep the service/secret key server-only; never use a `VITE_` prefix for it.
- Do not mark Milestone 2 complete based on PostgreSQL stubs or empty-schema advisors.
- The accepted Judge Demo is interactive within its isolated browser-local store; never claim it is read-only.
- Keep the passing Judge Demo browser isolation regression in CI. It verifies tested demo flows only; do not generalize it into a full managed-backend security sign-off.
