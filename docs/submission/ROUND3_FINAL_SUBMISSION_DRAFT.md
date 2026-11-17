# ProjectVault — Round 3 Final Submission Readiness Draft

**Team:** CYBERYODDHA  
**Project:** ProjectVault  
**Event:** CodersInPune Hackathon 2026  
**Live application:** https://project-vault-byzm.onrender.com  
**Repository:** https://github.com/Coding-warrior212/Project-Vault  
**Submission status:** Draft — do not mark final until all live tests and member details are completed.

## 1. Product summary

ProjectVault is a project-continuity workspace that helps outgoing contributors transfer project knowledge to incoming contributors. It organizes authorized project sources into evidence-linked claims, exposes missing or conflicting information, supports human review and prepares a handover dossier.

The core trust model is evidence-first: claims retain source references, uncertainty is visible, and human reviewers remain responsible for approval.

## 2. Final product and deployment

- Render service: `Project-Vault`
- Production URL: https://project-vault-byzm.onrender.com
- Repository: https://github.com/Coding-warrior212/Project-Vault
- Release commit: `963b61e2f99b4b4dbd57869faa7d36fd017ceff4`
- Render deploy: `dep-dbtg5sajnfac73dcg47g`
- Recorded Render result: `live` (2026-11-16)
- User-observed result: sign-up page loaded; email account creation sent a confirmation email; after confirmation, the user reached the workspace section.

**This is not yet proof that every workspace, upload, review, handover, invite, GitHub, Storage or Realtime action works end-to-end in production.**

## 3. Three Round 3 improvements committed in the Round 2 document

The Round 2 proposal identified the following three planned improvements. Their final status must be represented honestly:

### Improvement 1 — Shared cloud workspaces

**Implemented foundation:** Supabase Auth, workspace membership model, workspace-scoped database persistence, RLS policies, private file storage and Realtime subscriptions are present in the release.

**Acceptance evidence still required:** create a workspace with a real account; sign out/in; verify persisted records; access as a second authorized member; verify a different account cannot read or mutate the workspace; verify revocation removes access and clears stale client state.

**Current status:** Implemented foundation; live end-to-end acceptance pending.

### Improvement 2 — Live GitHub integration

**Implemented scope:** public GitHub repository URL and optional branch; fetch repository metadata; resolve a branch to a commit SHA; snapshot README and selected Markdown/text documentation files; persist snapshot metadata; manually sync to a latest commit.

**Not included:** private repository OAuth, background/scheduled synchronization, and private repository access.

**Acceptance evidence still required:** connect a public repository; inspect the recorded commit SHA and files; run manual latest sync; verify the snapshot updates without creating duplicates; test invalid URL, missing branch, private repository and API rate-limit errors.

**Current status:** Public-repository snapshot and manual sync implemented; live acceptance pending. Private OAuth/background sync not delivered.

### Improvement 3 — Knowledge graph and change impact analysis

**Implemented scope:** derived source-to-claim evidence relationships, source selection, claim inspection, verification counts, flagged claims and open conflicts related to a selected source.

**Not included:** persistent graph-node/edge generation as the source of truth, automatic dependency propagation, code-level impact analysis or automated staleness detection.

**Acceptance evidence still required:** ingest a source with claims; verify all links point to the correct source; inspect a source; confirm its claims and related open conflicts are shown; update/replace a source and verify the user is prompted to review linked claims before handover approval.

**Current status:** Evidence graph and basic derived impact view implemented; advanced graph/change propagation not delivered.

## 4. Core workflow acceptance checklist

Record the date, tester, test account role, exact steps, expected result, actual result and screenshot/log reference for each test.

| Test | Expected result | Status |
|---|---|---|
| Email sign-up | Account request accepted and confirmation email received | User-confirmed pass |
| Email confirmation | Confirmation returns user to app | User-confirmed pass |
| Sign-in | Valid account creates a session | Pending |
| Workspace selection | Only memberships for signed-in user are visible | Workspace section reached; access matrix pending |
| Workspace creation | Database creates workspace and owner membership atomically | Pending |
| Source upload | Metadata and file persist in the selected workspace | Pending |
| Claim/evidence review | Claims retain source references and review state persists | Pending |
| Conflict and missing-info review | Findings can be inspected and human-reviewed | Pending |
| Handover save/approval | Draft and approval persist; edits invalidate stale approval | Pending |
| Second-member access | Authorized member sees the same workspace data | Pending |
| Outsider isolation | Unrelated account cannot read or modify workspace data | Pending |
| Membership revocation | Revoked member loses access and stale client state clears | Pending |
| Invite create/redeem | Role, expiry, replay and use limits are enforced | Pending; server secret configuration required for redemption |
| Public GitHub snapshot/sync | Commit-pinned documentation snapshot can be refreshed | Pending |
| Knowledge graph | Source-to-claim relationships and related conflicts are inspectable | Pending |
| Google OAuth | Google account can authenticate and return to workspace selector | Not working yet; provider disabled |
| Gemini extraction/conflict analysis | Authorized server route returns structured results | Server-side session/role checks implemented; live end-to-end behavior pending |

## 5. Technical architecture and data flow

**Browser:** React + TypeScript + Vite + Tailwind CSS.  
**Application server:** Node.js + Express.  
**Identity:** Supabase Auth.  
**Data:** PostgreSQL 17 on Supabase with workspace-scoped RLS.  
**Files:** private Supabase Storage bucket with signed downloads.  
**Realtime:** Supabase Realtime subscriptions for supported workspace tables.  
**GitHub:** GitHub REST API for public repository documentation snapshots.  
**AI:** Gemini server integration is present. The two server routes validate Supabase sessions, workspace membership, and route-specific roles before reading workspace data through the user's JWT. Live managed-backend behavior and API-key availability are not independently verified in this audit.  
**Hosting:** Render.  
**CI/source control:** GitHub Actions and GitHub repository.

### Data flow

1. A user authenticates with Supabase Auth.
2. The application loads workspace memberships for the authenticated identity.
3. The user selects or creates an authorized workspace.
4. Source metadata and review records are read/written with the active workspace ID and RLS enforcement.
5. Uploaded source files are stored in a private bucket and downloaded using short-lived signed URLs.
6. Claims retain source references and review status.
7. Reviewers inspect evidence and unresolved items before approving a handover.
8. Realtime subscriptions refresh supported workspace views when records change.

## 6. Security and privacy

- Browser uses a publishable Supabase key only.
- Secret/service-role credentials must remain server-side and must never use a `VITE_` prefix.
- RLS is enabled on all 14 observed public application tables.
- Private source storage and signed downloads are implemented.
- Workspace access must be tested across owner/admin/editor/reviewer/viewer roles and unrelated accounts.
- The interactive Judge Demo uses a separate browser-local storage namespace and should not be described as read-only.
- Security Advisor findings require a fresh read-only review after the hosted schema state is confirmed. Earlier notes report authenticated-callable SECURITY DEFINER helper functions and disabled leaked-password protection; those observations are not re-verified in this audit.
- Direct owner-membership deletion is now being closed behind the atomic ownership-transfer/workspace-delete paths, with local regression coverage added on the development branch. Managed concurrency behavior still needs verification. AuthGate now clears stale workspace state on membership-verification failure and refreshes on membership Realtime events; managed event delivery still needs testing.
- No confidential third-party data should be used without authorization.

## 7. Testing notes

### Confirmed evidence

- GitHub Actions run [#43880847494](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43880847494) completed successfully on this submission-preparation branch. Both jobs passed: server security tests, TypeScript typecheck, production build, Playwright browser E2E tests, and disposable PostgreSQL 17 full-migration/schema/adversarial smoke tests. This does not prove managed Supabase behavior.
- Render deployment `dep-dbtg5sajnfac73dcg47g` reached `live`.
- Supabase project status was `ACTIVE_HEALTHY`.
- PR #1 release notes and this draft report eleven hosted migrations and fourteen public application tables with RLS enabled. The current development branch contains ten migration files; the additional reported security-permissions migration is not present in this repository snapshot. This discrepancy and the live schema state require a read-only migration-history check before any further migration or deployment.
- User personally confirmed email signup, email confirmation and arrival at the workspace section.

### Important limitations

- CI against disposable/local PostgreSQL is not equivalent to managed Supabase Auth, PostgREST, Storage or Realtime verification.
- Google OAuth is not enabled.
- Invite redemption requires the server-only secret key to be configured in Render.
- Gemini endpoints have server-side session and role checks; live endpoint behavior and API-key configuration remain unverified.
- Private GitHub OAuth/background sync is not delivered.
- Persistent graph and automatic change-impact propagation are not delivered.
- Individual member contributions have not been independently confirmed.

The exact workflow run URL is recorded above. Add the live test date, tester role, screenshots/log references and any additional exact test counts after the final judge-facing test pass. Never list a test as passing unless it was actually run.

## 8. Changes from the original plan

The initial plan included AI-assisted extraction, conflict resolution, role-aware sharing, version history and acknowledgement. During implementation, priorities shifted toward authenticated shared workspaces, cloud persistence, public GitHub documentation snapshots, and an evidence graph/change-impact inspection view.

The final report must distinguish:
- implemented features,
- implemented foundations awaiting live acceptance,
- intentionally disabled features,
- omitted features and future scope.

AI extraction/conflict analysis was initially disabled; server-side session and role checks have since been added, but managed-backend verification remains pending. Private GitHub OAuth/background sync and advanced graph propagation remain outside the delivered scope. These are deliberate safety/scope limitations, not completed improvements.

## 9. Team members and contributions

Each member must review and replace the draft below with a factual first-person account of their own work. Do not invent contributions.

| Member | Known team assignment / area | Individual statement |
|---|---|---|
| Ruchita Shinde | Backend / ingestion (planned role from team materials) | To be confirmed by member |
| Abhijit Gadade | Frontend / dashboard and review UI (planned role from team materials) | To be confirmed by member |
| Sanmay Dalvi | Team leader / backend (planned role from team materials) | To be confirmed by member |
| Saksham Singh | Database and authentication (planned role from team materials) | To be confirmed by member |

## 10. Final release and submission checklist

- [ ] Complete live core workflow from sign-up to approved handover.
- [ ] Complete workspace cross-account and role-based access tests.
- [ ] Resolve or document Google OAuth setup.
- [ ] Configure and test invite redemption securely, if included in final scope.
- [ ] Test public GitHub snapshot and manual sync.
- [ ] Demonstrate evidence graph and change-impact view.
- [ ] Resolve or explicitly disclose AI endpoint unavailability.
- [ ] Re-run CI on the exact final release commit and preserve the run URL.
- [ ] Re-run Supabase Security, Performance and Health Advisors; record findings and remediation.
- [ ] Update this report with actual test evidence.
- [ ] Confirm each member's role and individual contribution.
- [ ] Export the final project PDF and verify it on another device.
- [ ] Submit live link, repository, updated PDF, completed-improvements list, technical details, testing notes and individual contributions through the official submission channel.
- [ ] Save submission confirmation.

**Final integrity rule:** If a requirement is not verified, label it pending or incomplete. Do not claim complete end-to-end functionality, private GitHub integration, automated graph impact, or live AI extraction unless the exact deployed workflow has been demonstrated.


## 11. Development-branch audit addendum — 2026-11-17

- The reviewed development branch began this audit at `7d0360f8f949ae27bba40b0c1afc6450eef8a260`; `main` was at `d8e6452dbd656983e6c73a7349a3106345e4be37`. GitHub reports the refs as diverged (214 ahead / 2 behind). PR #1 and PR #2 are closed; do not force-reset or rebase the long-running development branch without reconciling the squash-merge history.
- The branch-head verification run [#43813583777](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43813583777) completed with both application and database jobs successful. The submission-preparation run [#43880847494](https://github.com/Coding-warrior212/Project-Vault/actions/runs/43880847494) also has both jobs recorded as successful. These runs validate CI and disposable PostgreSQL, not managed Supabase.
- The main-branch access refresh fix has been backported to the development branch: membership verification failures clear the active workspace, and membership-table Realtime events trigger a fresh server-authorized membership lookup.
- The development branch adds a guard against direct owner-membership deletion. Owner changes must use the capability-gated atomic transfer path; workspace deletion uses its dedicated atomic path. The new local assertions and smoke tests must pass in CI before this change is considered verified.
- The PR #1 description and this draft report eleven migrations in the hosted project, while the development repository contains ten migration files. The alleged additional security-permissions migration is not present in this branch. Retrieve/verify the exact hosted migration history and preserve the exact SQL in source control before any further migration.
- A previous read-only Supabase snapshot on 2026-11-15 reported an empty schema; later PR/release notes report eleven migrations and fourteen tables. The current audit could not independently reconcile this because the Supabase skill was not available in the connected tool context. Treat hosted migration count, table count, seed rows, advisors, and current project state as **unverified** until a fresh read-only check is possible.
- No production database, Auth, Storage, secrets, deployment, or pull-request merge action was performed in this audit. No paid infrastructure was created.
