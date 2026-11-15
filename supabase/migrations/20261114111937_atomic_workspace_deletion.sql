-- Atomic workspace deletion.
-- Only an authenticated, active workspace owner can invoke this RPC.
-- Internal capabilities are transaction-bound and actor-bound.

-- 1. Add a dedicated capability. Do not reuse owner_management.
CREATE OR REPLACE FUNCTION private.grant_operation_capability(
  p_operation text,
  p_actor_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
BEGIN
  IF p_operation NOT IN (
    'seed',
    'owner_management',
    'system_event',
    'claim_cleanup',
    'invite_redeem',
    'invite_revoke',
    'workspace_delete'
  ) THEN
    RAISE EXCEPTION 'Unsupported internal capability'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO private.operation_capabilities(
    transaction_id, operation, actor_id
  )
  VALUES (
    pg_catalog.pg_current_xact_id(), p_operation, p_actor_id
  )
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM private.operation_capabilities c
    WHERE c.transaction_id = pg_catalog.pg_current_xact_id()
      AND c.operation = p_operation
      AND c.actor_id IS NOT DISTINCT FROM p_actor_id
  ) THEN
    RAISE EXCEPTION 'Conflicting internal capability actor'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 2. A claim cascade must not try to update records that are themselves
-- being removed with the workspace.
CREATE OR REPLACE FUNCTION public.cleanup_deleted_claim_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
BEGIN
  IF private.has_operation_capability('workspace_delete')
     AND private.operation_actor('workspace_delete') = auth.uid()
     AND auth.uid() IS NOT NULL THEN
    RETURN OLD;
  END IF;

  IF public.is_demo_workspace(OLD.workspace_id)
     AND NOT private.has_operation_capability('seed') THEN
    RETURN OLD;
  END IF;

  PERFORM private.grant_operation_capability('claim_cleanup', NULL);

  UPDATE public.conflicts
     SET related_claim_ids = array_remove(related_claim_ids, OLD.id)
   WHERE workspace_id = OLD.workspace_id
     AND OLD.id = ANY (related_claim_ids);

  UPDATE public.missing_info
     SET supporting_claim_ids = array_remove(supporting_claim_ids, OLD.id)
   WHERE workspace_id = OLD.workspace_id
     AND OLD.id = ANY (supporting_claim_ids);

  UPDATE public.questions
     SET related_claim_ids = array_remove(related_claim_ids, OLD.id)
   WHERE workspace_id = OLD.workspace_id
     AND OLD.id = ANY (related_claim_ids);

  DELETE FROM private.operation_capabilities
   WHERE transaction_id = pg_catalog.pg_current_xact_id()
     AND operation = 'claim_cleanup';

  RETURN OLD;
END;
$$;

-- 3. Permit invite deletion only as part of an authenticated owner's
-- atomic workspace deletion. Ordinary invite deletion remains disabled.
CREATE OR REPLACE FUNCTION public.enforce_workspace_invite_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_role text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF auth.uid() IS NOT NULL
       AND private.has_operation_capability('workspace_delete')
       AND private.operation_actor('workspace_delete') = auth.uid() THEN
      RETURN OLD;
    END IF;

    RAISE EXCEPTION 'INVITE_DELETE_DISABLED'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'INVITE_TRUST_VIOLATION'
        USING ERRCODE = '42501';
    END IF;

    v_role := public.get_workspace_role(NEW.workspace_id);

    IF v_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'INSUFFICIENT_ROLE'
        USING ERRCODE = '42501';
    END IF;

    IF v_role = 'admin' AND NEW.granted_role = 'admin' THEN
      RAISE EXCEPTION 'ADMIN_PROTECTION'
        USING ERRCODE = '42501';
    END IF;

    NEW.created_by := auth.uid();
    NEW.uses_count := 0;
    NEW.revoked_at := NULL;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.code_hash IS DISTINCT FROM OLD.code_hash
       OR NEW.code_prefix IS DISTINCT FROM OLD.code_prefix
       OR NEW.granted_role IS DISTINCT FROM OLD.granted_role
       OR NEW.max_uses IS DISTINCT FROM OLD.max_uses
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'INVITE_IMMUTABLE'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.uses_count IS DISTINCT FROM OLD.uses_count
       AND (
         NOT private.has_operation_capability('invite_redeem')
         OR NEW.uses_count <> OLD.uses_count + 1
         OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
       ) THEN
      RAISE EXCEPTION 'INVITE_COUNTER_PROTECTED'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
      IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
        RAISE EXCEPTION 'INVITE_REVOCATION_ONE_WAY'
          USING ERRCODE = '42501';
      END IF;

      IF auth.uid() IS NOT NULL THEN
        v_role := public.get_workspace_role(OLD.workspace_id);
        IF v_role NOT IN ('owner', 'admin') THEN
          RAISE EXCEPTION 'INSUFFICIENT_ROLE'
            USING ERRCODE = '42501';
        END IF;
      ELSIF NOT private.has_operation_capability('invite_revoke') THEN
        RAISE EXCEPTION 'INVITE_TRUST_VIOLATION'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'UNSUPPORTED_INVITE_OPERATION'
    USING ERRCODE = '42501';
END;
$$;

-- 4. Extend the membership guard only for the new actor-bound operation.
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
     AND NOT private.has_operation_capability('owner_management')
     AND NOT private.has_operation_capability('invite_redeem') THEN
    RAISE EXCEPTION 'MEMBERSHIP_TRUST_VIOLATION'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE')
     AND auth.uid() IS NULL
     AND NOT private.has_operation_capability('owner_management') THEN
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

-- 5. Atomic owner-only workspace deletion.
CREATE OR REPLACE FUNCTION public.delete_workspace_atomic(
  p_workspace_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_demo boolean;
  v_caller_role text;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_authenticated_non_demo() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(p_workspace_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_WORKSPACE_ID'
      USING ERRCODE = '22023';
  END IF;

  -- Lock invites first, matching the invite-redemption RPC lock order.
  PERFORM 1
    FROM public.workspace_invites wi
   WHERE wi.workspace_id = p_workspace_id
   ORDER BY wi.id
   FOR UPDATE;

  -- Then lock memberships in a stable order.
  PERFORM 1
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id
   ORDER BY wm.id
   FOR UPDATE;

  -- Lock the workspace after memberships to avoid lock-order deadlocks.
  SELECT w.is_demo
    INTO v_is_demo
    FROM public.workspaces w
   WHERE w.id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_is_demo THEN
    RAISE EXCEPTION 'DEMO_WORKSPACE_IMMUTABLE'
      USING ERRCODE = '42501';
  END IF;

  -- Verify ownership only after the relevant locks are held.
  SELECT wm.role
    INTO v_caller_role
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id
     AND wm.user_id = v_actor_id;

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'OWNER_ONLY: Only an active workspace owner can delete this workspace'
      USING ERRCODE = '42501';
  END IF;

  PERFORM private.grant_operation_capability('workspace_delete', v_actor_id);

  DELETE FROM public.workspaces
   WHERE id = p_workspace_id
     AND is_demo = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKSPACE_DELETE_FAILED'
      USING ERRCODE = '40001';
  END IF;

  DELETE FROM private.operation_capabilities
   WHERE transaction_id = pg_catalog.pg_current_xact_id()
     AND operation = 'workspace_delete';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_workspace_atomic(text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_workspace_atomic(text)
  TO authenticated;
