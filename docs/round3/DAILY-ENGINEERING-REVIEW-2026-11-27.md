# ProjectVault Daily Engineering Review — 2026-11-27

**Repository:** `Coding-warrior212/Project-Vault`  
**Branch:** `round3-development`  
**Review date:** 2026-11-27  
**Scope:** Read-only GitHub/Supabase inspection. No hosted writes, migrations, deployments, merges, secret changes, or paid resources.

## Executive result

- The current branch head is `d3629e71e546cd87b305f4626a813659ea9e1e96` (documentation-only commit).
- The current head's GitHub Actions run [#45764307863](https://github.com/Coding-warrior212/Project-Vault/actions/runs/45764307863) completed successfully: both the PostgreSQL 17 migration/adversarial job and application tests/typecheck/build job passed.
- The latest code-bearing snapshot identified in the milestone tracker, `38f57d0687c9d48e81f9395223aed1d17b174c32`, also passed both jobs in [#45763275149](https://github.com/Coding-warrior212/Project-Vault/actions/runs/45763275149).
- The branch contains 16 SQL migration files. The connected hosted project records 11 migrations.
- Comparing `round3-development` to `main`: **306 ahead, 3 behind**, merge base `67cd33b0a003c7590c12f5d18a5b2a316167a1ea`. GitHub reports the branch as diverged; branch protection is disabled.
- **Milestone 2 remains open. No milestone is declared fully complete.**

## Fresh connected Supabase read-only verification

Project `asjxqshuvepjsqzttafc` is `ACTIVE_HEALTHY`, PostgreSQL 17.11.0.019, region `ap-northeast-2`.

A read-only catalog query confirmed:

- 14 public application tables; RLS is enabled on all 14.
- The hosted `workspace_members_delete_policy` does not exclude `role = 'owner'`.
- The hosted `enforce_workspace_member_guards()` definition does not contain the development guard `OWNER_DELETE_REQUIRES_TRANSFER`.
- The hosted trigger therefore does not enforce the development branch's explicit atomic owner-departure requirement. Concurrent owner-removal safety has not been tested with two managed sessions.
- Hosted effective EXECUTE privileges still allow `service_role` to execute `create_workspace_atomic(text,text,text,text,uuid)` and `transfer_workspace_ownership_atomic(text,uuid,text,uuid)`. The development migration `20261126110000_revoke_service_role_workspace_owner_rpcs.sql` revokes these two grants, but has not been applied to the hosted project.
- The hosted `postgres` default ACLs for `public` still grant API-role privileges on future tables, sequences, and functions. Development migration `20261124110000_restrict_public_default_privileges.sql` addresses this for objects created by `postgres`, but remains development-only.
- Hosted migration history contains 11 entries. The hosted-only migration name `restrict_security_definer_function_execution` (version `20261116131735`) still has no exact SQL source in either branch.

These are configuration/privilege mismatches and concurrency risks. This audit did not demonstrate a cross-workspace data disclosure or execute an exploit.

### Advisor snapshot — 2026-11-27

- Security: 9 authenticated SECURITY DEFINER execution warnings; 1 leaked-password-protection warning; 1 informational RLS/no-policy finding for the private capability table.
- Performance: 15 unindexed foreign keys; 9 unused-index notices.
- Health: no lints.

The leaked-password protection capability is not available on the free tier; no paid upgrade is recommended. The private capability table finding is consistent with its intended isolation, but its API-role denial remains part of the acceptance matrix.

## Migration and CI evidence

Development migration files (16):

1. `202611140001_projectvault_round3.sql`
2. `20261114111937_atomic_workspace_deletion.sql`
3. `20261114115437_allow_workspace_delete_capability.sql`
4. `202611150001_atomic_workspace_member_role_change.sql`
5. `20261115120000_preserve_append_only_activity_references.sql`
6. `20261115130000_workspace_delete_broadcast.sql`
7. `20261115140000_harden_trigger_function_search_paths.sql`
8. `20261115150000_optimize_auth_rls_policies.sql`
9. `20261115160000_add_important_foreign_key_indexes.sql`
10. `20261115170000_reconcile_activity_event_reference_validation.sql`
11. `20261117110000_require_atomic_owner_membership_changes.sql`
12. `20261118100000_membership_revocation_broadcast.sql`
13. `20261122110000_revoke_anon_execute_from_security_helpers.sql`
14. `20261122120000_revoke_anonymous_workspace_table_access.sql`
15. `20261124110000_restrict_public_default_privileges.sql`
16. `20261126110000_revoke_service_role_workspace_owner_rpcs.sql`

The two verified CI runs above establish disposable PostgreSQL 17 migration/schema/adversarial checks and application server tests, typecheck, production build, and Playwright E2E. They do **not** establish managed Supabase/PostgREST/Auth/Storage/Realtime behavior.

## Eight-milestone status

| # | Milestone | Status | Remaining acceptance gates |
|---|---|---|---|
| 1 | Development foundation | In progress | Reconcile diverged history; decide branch protection/governance; review release branch strategy. |
| 2 | Supabase compatibility/security | **Open — no sign-off** | Reconcile 16 dev / 11 hosted / 10 main histories; obtain hosted-only migration SQL; verify PostgREST capabilities, role/tenant isolation, owner concurrency, invites, Storage, Realtime, Auth and Advisors. |
| 3 | Authentication and RBAC | Partial | Managed Google OAuth/callback, email confirmation/recovery, invite lifecycle and all five roles. |
| 4 | Cloud persistence and Realtime | Partial | Managed Storage lifecycle, local-to-cloud import preservation, membership-revocation Broadcast delivery and reconnect behavior. |
| 5 | Three promised improvements | Partial | Private GitHub OAuth/background sync and automated dependency/change-impact/staleness propagation. |
| 6 | Judge Demo | Browser isolation verified | Keep browser-local isolation regression. The demo is interactive, not read-only, and is not proof of managed backend security. |
| 7 | Security and E2E | CI verified; managed acceptance open | Managed negative tests, Auth/Gemini integration, invite/owner concurrency, PostgREST, Storage and Realtime. |
| 8 | Final deployment/submission | Not ready | Render/workspace read-only recheck, final acceptance evidence, submission PDF and verified team contributions. |

## Risks and unverified assumptions

1. The owner guard and service-role RPC revocations are present in development, not hosted. Do not treat them as live protection.
2. Broad hosted default ACLs and anonymous table grants remain. RLS is enabled, but ACL/policy alignment is still required.
3. The hosted-only migration's name is known; its SQL semantics are not. Do not reconstruct or mark equivalent by guesswork.
4. The local PostgreSQL harness uses Auth/Storage stand-ins. It cannot prove managed PostgREST transaction binding, OAuth, Storage API semantics, Realtime authorization/cache behavior, or two-session concurrency.
5. The latest branch CI passed, but the branch remains unprotected and diverged from main. Do not merge, reset, or rebase automatically.

## Next safe work

- Continue static review of migration ordering, RLS policy semantics, capability helper boundaries, Auth/Gemini routes, invite redemption and UI role checks.
- Add disposable/local regression coverage for owner concurrency and RPC privilege boundaries where the harness can faithfully model them.
- Preserve the existing managed acceptance matrix and clearly label any local-only evidence.
- Keep hosted changes gated behind a separate user-approved release process; this recurring review must never apply them.

## User action required

**None today.** The missing hosted-only migration SQL would materially improve migration reconciliation if the user has the original file. Render read-only monitoring also remains pending workspace confirmation. Neither blocks static repository review or local test design.

## Safety record

Only GitHub reads, Supabase project/catalog reads, migration inventory, and Advisor reads were performed. No Supabase schema/data/Auth/Storage changes, migrations, deployments, merges, secret changes, or paid resources were used.
