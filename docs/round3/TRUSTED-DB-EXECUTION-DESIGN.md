# ProjectVault — Trusted Database Execution Boundary (Milestone 2)

**Status:** Proposed design for review; no SQL applied  
**Branch:** round3-development  
**Purpose:** Replace authorization decisions based on forgeable custom PostgreSQL settings.

## 1. Security objective

A caller must not be able to bypass demo immutability, role checks, audit integrity, owner protections, or referential cleanup by setting a custom PostgreSQL GUC such as projectvault.seed_mode, projectvault.owner_rpc_active, projectvault.system_event_active, or projectvault.cascade_cleanup.

Custom GUC values are context, not authentication. A check that only compares a setting to 'on' is not a trusted boundary.

## 2. Proposed model: narrow privileged entry points + transaction-scoped private capability records

Use a non-exposed private schema for internal security metadata and helper functions. Do not grant anon or authenticated direct access to its tables or helper functions.

A transaction-scoped capability record is created only by a narrowly granted SECURITY DEFINER entry point. The record is bound to the current transaction ID and a specific operation/context. Trigger code checks the private record rather than trusting a GUC.

Conceptual shape (not production SQL):

- private.trusted_operation_context: transaction identifier, operation name/capability, optional workspace identifier, actor identifier where applicable, and created timestamp.
- Entry-point RPC validates caller and operation, inserts the context row, performs its work, and removes the context row before returning.
- Trigger code uses a private helper that is not executable by API roles and verifies a matching context exists for the current transaction and exact operation.
- The context row is transaction-scoped and must not survive a committed transaction. Use transaction identity carefully; do not use a reusable session identifier alone.
- The capability is operation-specific, not a generic trusted=true switch.

This design is a proposal. Before coding it, validate the exact PostgreSQL transaction-ID functions and Supabase role execution behavior on the project's PostgreSQL version. A private table alone is not sufficient unless its write/read path and function ownership/grants are demonstrably non-forgeable.

## 3. Role and ownership rules

- Keep private out of Supabase exposed schemas.
- Revoke default PUBLIC privileges on private schema objects.
- Do not grant API roles direct INSERT/UPDATE/DELETE on capability records.
- Use a dedicated NOLOGIN owner for internal SECURITY DEFINER functions where supported by Supabase's managed role model; verify role creation/ownership constraints before migration.
- Every SECURITY DEFINER function must set a fixed safe search_path and schema-qualify sensitive references.
- Revoke default PUBLIC EXECUTE on every function, including trigger helpers.
- Grant only exact RPC signatures to the intended API role.
- Do not expose internal helper functions as RPC endpoints.
- Keep service-role credentials only in the trusted backend; never ship the secret key to the browser.

## 4. Operation-specific capabilities

| Operation | Only allowed creator | Trigger behavior enabled |
|---|---|---|
| seed_demo | Controlled migration/operator path only | Insert initial demo fixtures; never a public runtime capability |
| create_workspace | create_workspace_atomic | Create workspace and initial owner membership atomically |
| transfer_ownership | transfer_workspace_ownership_atomic | Perform the two membership role changes while enforcing last-owner invariants |
| redeem_invite | Service-only invite redemption RPC | Add membership and increment invite use count atomically |
| system_audit_event | Internal RPCs that independently validate actor context | Mark a system-generated audit event; actor remains attributable |
| cascade_cleanup | Referential cleanup trigger path only | Cleanup dependent references only when invoked by the intended delete operation |

Do not let a general-purpose capability authorize unrelated tables or operations. Prefer ordinary foreign-key cascades and declarative constraints over custom cascade bypasses wherever possible.

## 5. Trusted actor model

### Authenticated user RPCs

- Derive the caller from auth.uid(); ignore caller-supplied actor IDs for normal user requests.
- Verify non-demo authenticated status.
- Verify workspace membership and role inside the database transaction.
- Do not accept a user-supplied p_owner_id or p_acting_owner_id as proof of identity.
- If an RPC supports service-role invocation for backend workflows, split it into a separate service-only function signature/path rather than mixing user and service identity branches.

### Service-role backend workflows

- Express must validate the bearer token using Supabase Auth server-side.
- Derive actor ID from the verified token, never from request body or unverified headers.
- Resolve workspace membership/role before privileged operations.
- Keep SUPABASE_SECRET_KEY server-only.
- A service-role database call is privileged; it must be made only after backend actor authorization.
- Record verified actor and operation in audit events. A string such as actor_source='server_verified' is not proof by itself.

## 6. Demo seed and immutability

- Seed only through a controlled migration/operator execution path.
- Do not create a runtime RPC that lets an ordinary authenticated caller set demo seed mode.
- After seeding, demo rows are immutable to anon, authenticated, and service-role application paths.
- Because service_role bypasses RLS, backend middleware alone is not a database-level guard. Any privileged backend path that can write must have an explicit database-side guard or use a constrained function that refuses demo workspace IDs.
- Storage objects require separate consideration: managed storage.objects triggers are not assumed available. The backend must reject demo writes and storage RLS policies must deny client writes to demo paths. Do not claim database trigger protection on Storage objects.

## 7. Invite integrity

- Immutable after insert: id, workspace_id, code_hash, code_prefix, granted_role, max_uses, expires_at, created_by, created_at.
- uses_count may only increase by exactly one through the invite redemption capability; never decrease or be directly set by clients.
- revoked_at may transition only from NULL to a timestamp; it cannot be cleared or rewritten.
- Admin may issue only editor/reviewer/viewer invitations; owner may issue admin/editor/reviewer/viewer; no invite grants owner.
- Redemption locks the invite row, validates expiry/revocation/use count, handles existing membership idempotently, inserts membership, and increments uses_count in the same transaction.
- A repeated redemption by an existing member must not consume another use.

## 8. Required adversarial test matrix

1. anon sets each legacy GUC to on and attempts demo writes: denied.
2. authenticated sets each legacy GUC to on and attempts demo writes: denied.
3. Authenticated owner sets owner_rpc_active=on and attempts to add/promote an owner: denied outside the approved RPC.
4. Authenticated user sets system_event_active=on and inserts a forged system audit event: denied or rewritten to JWT actor.
5. Authenticated user sets cascade_cleanup=on and deletes/rewrites unrelated records: denied.
6. Authenticated user attempts to create a trusted context record directly: permission denied.
7. Authenticated user attempts to invoke private helper functions: permission denied.
8. Invite admin attempts to issue owner/admin invite: denied.
9. Invite uses_count is edited directly, decremented, jumped, or incremented twice: denied.
10. Invite revoked_at is cleared or rewritten: denied.
11. Invite redemption races at max_uses=1: exactly one new membership/use succeeds.
12. Service-role route passes a request-body actor different from verified JWT actor: backend rejects; audit uses verified actor.
13. Service-role route attempts any mutation against ws-apex: denied.
14. A normal user attempts to create a demo workspace or alter is_demo: denied.
15. Seed capability is unavailable to anon/authenticated and cannot be created by forged GUC.
16. Workspace deletion/cascade cleanup leaves no cross-workspace or orphaned graph references.
17. Last owner cannot be removed/demoted, including concurrent attempts.

## 9. Design caveats to resolve before writing migration SQL

- Validate availability and semantics of transaction ID functions on the actual Supabase PostgreSQL version; use a collision-safe transaction key and account for transaction ID wraparound.
- Confirm which managed roles can own functions/create roles in this Supabase project. Do not assume a new NOLOGIN role can be created without checking.
- Ensure a trusted capability cannot be reused by a second operation in the same transaction.
- Define how nested trigger execution and FK cascades interact with capability checks; do not authorize broad bypasses using pg_trigger_depth() alone.
- Keep all privileged entry points atomic and exception-safe; transaction rollback must remove capability state.
- Review whether any required operation can instead be implemented with ordinary constraints/FK cascades, eliminating a privileged bypass entirely.
- Ensure function owner has only privileges required for the operation; SECURITY DEFINER is not a substitute for least privilege.

## 10. Decision gate

This document is a proposed design, not production SQL. Next work is to verify managed-role feasibility and PostgreSQL semantics, then write function/trigger bodies and the exact grant matrix. Run the migration on a disposable local Supabase stack and complete the adversarial matrix before any hosted migration.

No hosted database, production secret, or deployment was changed by this document.
