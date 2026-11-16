# ProjectVault

**Knowledge that stays. Projects that move.**  
An evidence-backed project continuity and handover workspace by **CYBERYODDHA** for CodersInPune Hackathon 2026.

ProjectVault helps an outgoing contributor transfer project context to the next contributor without relying on undocumented memory. It organizes source material, extracted claims, verification state, unresolved questions, conflicts and human-approved handovers in a workspace-scoped workflow.

## Live project

- **Application:** https://project-vault-byzm.onrender.com
- **Source code:** https://github.com/Coding-warrior212/Project-Vault
- **Deployment:** Render web service, automatically deployed from `main`
- **Data and authentication:** Supabase Auth, PostgreSQL, Row Level Security, private Storage and Realtime

## Product workflow

1. **Connect** — add supported documents and notes; connect a public GitHub repository snapshot.
2. **Reconstruct** — organize project knowledge into structured claims and context.
3. **Verify** — inspect supporting excerpts, source references, uncertainty and conflicts.
4. **Review** — let an authorized human approve, reject or flag claims and address missing information.
5. **Handover** — prepare and approve a traceable continuation dossier for the incoming contributor.

The product is designed around three principles: evidence before confidence, uncertainty remains visible, and people—not an AI model—approve consequential handover decisions.

## Implemented capabilities

- Email/password account creation, email confirmation, sign-in, password recovery and session restoration through Supabase Auth.
- Workspace selection and atomic workspace creation.
- Workspace-scoped persistence for source metadata, claims, conflicts, questions, missing-information findings, activity and handover records.
- Private source-file storage with signed downloads.
- Row Level Security policies and role-aware workspace access.
- Realtime refresh for supported workspace records.
- Public GitHub documentation snapshots pinned to a commit, with a manual latest-commit sync action.
- Source-to-claim evidence graph and a derived change-impact inspection view.
- Interactive Judge Demo isolated in browser-local storage; demo edits do not write to team workspaces.

## Important scope and availability disclosures

This repository intentionally does **not** claim that every planned integration is complete.

- Google OAuth initiation is present in the UI, but the Google provider must be enabled and configured in the Supabase dashboard with Google OAuth credentials before it can work.
- Private GitHub repository OAuth and scheduled/background synchronization are not included; the current GitHub connector supports public repository documentation snapshots.
- The knowledge graph is a derived source-to-claim evidence view. Persistent graph-node/edge construction and automatic dependency propagation/staleness analysis are not complete.
- The Gemini extraction and conflict-analysis endpoints are protected and currently fail closed until the complete server-side authorization and managed-backend verification gates are signed off. Do not treat AI reconstruction as available in the hosted workflow until that is changed and tested.
- Invite redemption requires the server-only `SUPABASE_SECRET_KEY` in Render. It must never be exposed through a `VITE_` browser variable.
- A successful deployment and local CI are not substitutes for live end-to-end verification against managed Supabase Auth, PostgREST, Storage and Realtime.

See [Round 3 engineering status](docs/ROUND3_ENGINEERING_STATUS.md), [milestone tracker](docs/round3/ROUND3-MILESTONE-STATUS.md), and [final submission readiness draft](docs/submission/ROUND3_FINAL_SUBMISSION_DRAFT.md) for verification details and remaining gates.

## Technology

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL 17 with RLS |
| File storage | Supabase private Storage bucket |
| Realtime | Supabase Realtime |
| GitHub source connector | GitHub REST API (public repositories) |
| AI integration | Google Gemini server integration; protected endpoints currently fail closed |
| Hosting | Render |
| Source control and CI | GitHub |

## Local development

Requirements: Node.js 22.x and npm.

```bash
npm install --legacy-peer-deps
npm run dev
```

Create a local `.env` file using the variable names documented in the deployment configuration. Never commit credentials.

For a production build and server:

```bash
npm run build
npm start
```

Useful verification commands:

```bash
npm run lint
npm run test:server
npm run test:e2e
```

Database migration validation scripts and the local PostgreSQL harness are documented under `supabase/tests/` and `scripts/`. A local PostgreSQL harness does not prove managed Supabase behavior.

## Security notes

- Browser code uses only the Supabase publishable key.
- Supabase secret/service-role credentials are server-only.
- Workspace authorization is enforced by database policies and authenticated sessions, not by hiding UI controls.
- Private source files are stored in a private bucket and downloaded through short-lived signed URLs.
- The Judge Demo uses a separate browser-local namespace and is explicitly an interactive demonstration, not a read-only production workspace.
- Do not upload confidential or personal project data unless you have authorization to do so.

## Team

**CYBERYODDHA**
- Ruchita Shinde
- Abhijit Gadade
- Sanmay Dalvi
- Saksham Singh

Individual contribution statements should be completed by each member and must describe their actual work.

## Project status

ProjectVault has a live deployment and a substantial Round 3 implementation. Some integrations and managed-backend release checks remain incomplete. The team should use the current milestone tracker and final submission readiness draft as the source of truth, update them with fresh test evidence, and avoid presenting planned or partially implemented capabilities as completed.
