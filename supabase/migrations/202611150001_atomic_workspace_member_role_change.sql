-- ----------------------------------------------------------------------------
-- ProjectVault: Atomic Workspace Member Role Management
-- Only the authenticated workspace owner may change another member's role.
-- Role update and audit event are committed or rolled back together.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.change_workspace_member_role_atomic(
  p_workspace_id text,
  p_target_user_id uuid,
  p_new_role text
)
RETURNS TABLE (
  target_user_id uuid,
  previous_role text,
  new_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_target_role text;
  v_caller_name text;
BEGIN
  -- Require a real authenticated user.
  IF NOT public.is_authenticated_non_demo() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Sign in to manage workspace members'
      USING ERRCODE = '42501';
  END IF;

  v_caller_id := auth.uid();

  IF NULLIF(btrim(COALESCE(p_workspace_id, '')), '') IS NULL
     OR p_target_user_id IS NULL
     OR p_new_role IS NULL
     OR p_new_role NOT IN ('admin', 'editor', 'reviewer', 'viewer') THEN
    RAISE EXCEPTION 'INVALID_ROLE_CHANGE: Workspace, target, and a permitted role are required'
      USING ERRCODE = '22023';
  END IF;

  IF public.is_demo_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'DEMO_WORKSPACE_IMMUTABLE: Demo workspace membership cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'SELF_ROLE_CHANGE_DENIED: You cannot change your own workspace role'
      USING ERRCODE = '42501';
  END IF;

  -- Lock workspace memberships deterministically to prevent concurrent
  -- role changes from racing with this operation.
  PERFORM 1
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id
   ORDER BY wm.id
   FOR UPDATE;

  SELECT wm.role
    INTO v_caller_role
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id
     AND wm.user_id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'OWNER_ONLY: Only the active workspace owner can change member roles'
      USING ERRCODE = '42501';
  END IF;

  SELECT wm.role
    INTO v_target_role
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id
     AND wm.user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_NOT_MEMBER: The selected user is not a member of this workspace'
      USING ERRCODE = '23503';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'OWNER_PROTECTION: Ownership changes require the dedicated ownership transfer operation'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role = p_new_role THEN
    RAISE EXCEPTION 'ROLE_UNCHANGED: The member already has this role'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
    INTO v_caller_name
    FROM public.profiles p
   WHERE p.id = v_caller_id;

  -- Reuse the existing transaction-scoped protections. These capabilities
  -- are granted only after the caller and target have been validated above.
  PERFORM private.grant_operation_capability('owner_management', v_caller_id);
  PERFORM private.grant_operation_capability('system_event', v_caller_id);

  UPDATE public.workspace_members
     SET role = p_new_role
   WHERE workspace_id = p_workspace_id
     AND user_id = p_target_user_id;

  -- The existing activity trust trigger stamps the authenticated actor
  -- from the transaction-scoped system_event capability.
  INSERT INTO public.activity_events (
    workspace_id,
    type,
    timestamp_label,
    title,
    description,
    actor,
    actor_user_id,
    actor_source
  ) VALUES (
    p_workspace_id,
    'member_role_changed',
    'Just now',
    'Workspace Member Role Updated',
    COALESCE(v_caller_name, 'Workspace Owner')
      || ' changed a workspace member role from '
      || v_target_role
      || ' to '
      || p_new_role
      || '.',
    COALESCE(v_caller_name, 'Workspace Owner'),
    v_caller_id,
    'system_trigger'
  );

  DELETE FROM private.operation_capabilities
   WHERE transaction_id = pg_catalog.pg_current_xact_id()
     AND operation IN ('owner_management', 'system_event');

  RETURN QUERY
    SELECT p_target_user_id, v_target_role, p_new_role;
END;
$$;

-- The function is callable by authenticated users only. The function itself
-- performs the Owner and membership checks; no client can grant capabilities.
REVOKE ALL ON FUNCTION public.change_workspace_member_role_atomic(text, uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.change_workspace_member_role_atomic(text, uuid, text)
  TO authenticated;
