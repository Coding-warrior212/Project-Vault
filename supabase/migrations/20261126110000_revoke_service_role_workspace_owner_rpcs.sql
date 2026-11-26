-- Workspace creation and ownership transfer are browser-authenticated RPCs.
-- Their service_role branches accept p_owner_id / p_acting_owner_id values that
-- cannot establish end-user identity by themselves. The current application
-- calls create_workspace_atomic with the user's JWT; no server-side route uses
-- either RPC. Keep privileged service-role workflows on separate, verified
-- server-only endpoints such as invite redemption.
--
-- This is a development-branch migration. Do not apply it to the live project.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_workspace_atomic(text, text, text, text, uuid)
  FROM service_role;

REVOKE EXECUTE ON FUNCTION public.transfer_workspace_ownership_atomic(text, uuid, text, uuid)
  FROM service_role;

COMMIT;
