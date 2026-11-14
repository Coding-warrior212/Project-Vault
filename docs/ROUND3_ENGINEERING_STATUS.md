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

## Security design
- Browser code uses only the Supabase publishable key.
- The Supabase secret/service-role key is never exposed through a `VITE_` variable.
- Data access depends on the database RLS policies and the authenticated user's JWT.
- The app does not import local demo records into authenticated workspaces.
- AI extraction and conflict-analysis API routes remain fail-closed (HTTP 503) until server-side user, workspace, and source authorization is implemented.

## Verification evidence

The latest completed GitHub Actions verification before the judge-demo namespace changes passed:
- Server security tests: **7/7**
- TypeScript type-check: **pass**
- Vite production build: **pass**
- Disposable PostgreSQL 17 migration, schema assertions, and adversarial smoke tests: **pass**

The local Supabase Auth lifecycle test previously passed signup, password login, session identity verification, and disposable account cleanup. The local RBAC runtime test previously passed 23 checks covering workspace creation, invite redemption, role enforcement, and outsider isolation.

## Not yet verified / remaining release gates
- The new browser cloud adapter, file upload/download, handover UI, realtime behavior, and GitHub sync still require a full end-to-end run against the local Supabase stack after pulling this branch.
- The hosted Supabase project has not been linked or migrated; no hosted schema/data changes have been made.
- Google OAuth provider configuration has not been verified in the Supabase dashboard.
- AI extraction and conflict analysis remain disabled pending secure server-side authorization.
- The judge demo is interactive and storage-namespaced in code, but it still needs browser verification of entry, edits across all supported workflows, reset-to-seed behavior, and proof that pre-existing browser-local records remain unchanged.
- GitHub private-repository OAuth and scheduled/background sync are not included.
- The knowledge graph is source-to-claim evidence tracing, not full graph-node/edge persistence or automatic dependency propagation.
- Deployment, PR merge, production migration, final PDF refresh, and submission have not been performed.

## Team contribution record
Do not infer individual contributions. Confirm each member's actual work before completing the submission contribution section:
- Ruchita Shinde
- Abhijit Gadade
- Sanmay Dalvi
- Saksham Singh
