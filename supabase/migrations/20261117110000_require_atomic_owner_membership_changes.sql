-- Require atomic ownership transfer before an owner membership can be removed.
-- Direct owner DELETE is denied by RLS and by the trigger (including RLS-bypass callers).
-- Workspace deletion remains allowed through its actor-bound workspace_delete capability.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_workspace_member_guards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_actor_role text;
  v_delete_active boolean :=
    auth.uid() IS NOT NULL
    AND private.has_operation_capability('workspace_delete')
    AND private.operation_actor('workspace_delete') = auth.uid();
  v_rpc_active boolean :=
    private.has_operation_capability('owner_management');
BEGIN
  IF auth.uid() IS NULL
     AND NOT v_rpc_active
     AND NOT private.has_operation_capability('invite_redeem') THEN
    RAISE EXCEPTION 'MEMBERSHIP_TRUST_VIOLATION'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE')
     AND auth.uid() IS NULL
     AND NOT v_rpc_active THEN
    RAISE EXCEPTION 'MEMBERSHIP_TRUST_VIOLATION'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'owner' AND NOT v_rpc_active THEN
      RAISE EXCEPTION 'OWNER_PROTECTION: Owner memberships require an atomic RPC'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_delete_active THEN
      RAISE EXCEPTION 'WORKSPACE_DELETE_SCOPE: Membership updates are not allowed'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.joined_via_invite_id IS DISTINCT FROM OLD.joined_via_invite_id
       OR NEW.added_by IS DISTINCT FROM OLD.added_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Immutable membership columns cannot be modified'
        USING ERRCODE = '42501';
    END IF;

    IF (OLD.role = 'owner' OR NEW.role = 'owner') AND NOT v_rpc_active THEN
      RAISE EXCEPTION 'OWNER_PROTECTION: Owner role changes require ownership transfer'
        USING ERRCODE = '42501';
    END IF;

    IF auth.uid() IS NOT NULL AND NOT v_rpc_active THEN
      v_actor_role := public.get_workspace_role(OLD.workspace_id);

      IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'INSUFFICIENT_ROLE'
          USING ERRCODE = '42501';
      END IF;

      IF v_actor_role = 'admin' THEN
        IF OLD.user_id = auth.uid()
           OR OLD.role IN ('owner', 'admin')
           OR NEW.role IN ('owner', 'admin') THEN
          RAISE EXCEPTION 'ADMIN_PROTECTION'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_delete_active THEN
      RETURN OLD;
    END IF;

    -- An owner must transfer ownership first. This prevents a direct self-delete
    -- or owner-to-owner removal from racing the AFTER-trigger owner count.
    IF OLD.role = 'owner' AND NOT v_rpc_active THEN
      RAISE EXCEPTION 'OWNER_DELETE_REQUIRES_TRANSFER: Owner memberships can only be removed through ownership transfer or workspace deletion'
        USING ERRCODE = '42501';
    END IF;

    IF auth.uid() IS NOT NULL AND NOT v_rpc_active THEN
      v_actor_role := public.get_workspace_role(OLD.workspace_id);

      IF OLD.user_id <> auth.uid() THEN
        IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
          RAISE EXCEPTION 'INSUFFICIENT_ROLE'
            USING ERRCODE = '42501';
        END IF;

        IF v_actor_role = 'admin' AND OLD.role IN ('owner', 'admin') THEN
          RAISE EXCEPTION 'ADMIN_PROTECTION'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_workspace_member_guards()
  FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS workspace_members_delete_policy
  ON public.workspace_members;

CREATE POLICY workspace_members_delete_policy
  ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    NOT public.is_demo_workspace(workspace_id)
    AND role <> 'owner'
    AND (
      user_id = (SELECT auth.uid())
      OR public.has_workspace_role(workspace_id, ARRAY['owner'])
      OR (
        public.has_workspace_role(workspace_id, ARRAY['admin'])
        AND role NOT IN ('owner', 'admin')
      )
    )
  );

COMMIT;
