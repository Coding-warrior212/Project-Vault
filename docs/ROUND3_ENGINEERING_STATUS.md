# ProjectVault — Round 3 Engineering Status

**Team:** CYBERYODDHA  
**Tagline:** Knowledge that stays. Projects that move.  
**Working branch:** `round3-development`  
**Pull request:** #1 (draft; intentionally not merged)

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
- AI extraction and conflict-analysis API routes remain fail-closed (HTTP 503) until server-side user, workspace, and source authorization is implemented.

## Verification evidence

The latest completed GitHub Actions verification on the isolated Judge Demo namespace commit passed (run #43620652179):
- Server security and storage-namespace tests: **10/10**
- TypeScript type-check: **pass**
- Vite production build: **pass**
- Disposable PostgreSQL 17 migration, schema assertions, and adversarial smoke tests: **pass**

The local Supabase Auth lifecycle test previously passed signup, password login, session identity verification, and disposable account cleanup. The local RBAC runtime test previously passed 23 checks covering workspace creation, invite redemption, role enforcement, and outsider isolation.

## Not yet verified / remaining release gates
- The new browser cloud adapter, file upload/download, handover UI, realtime behavior, and GitHub sync still require a full end-to-end run against the local Supabase stack after pulling this branch.
- The hosted Supabase project has not been linked or migrated; no hosted schema/data changes have been made.
- Google OAuth provider configuration has not been verified in the Supabase dashboard.
- AI extraction and conflict analysis remain disabled pending secure server-side authorization.
- The interactive judge demo's entry, supported review/handover interactions, refresh persistence, and reset-to-seed behavior have now passed browser checks. A separate browser check that pre-existing default-scope records remain unchanged across entering/exiting/resetting Judge Demo is still open.
- GitHub private-repository OAuth and scheduled/background sync are not included.
- The knowledge graph is source-to-claim evidence tracing, not full graph-node/edge persistence or automatic dependency propagation.
- Deployment, PR merge, production migration, final PDF refresh, and submission have not been performed.

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
