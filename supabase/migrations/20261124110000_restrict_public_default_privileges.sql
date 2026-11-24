-- Reconcile Supabase's postgres-owned public-schema defaults with the
-- least-privilege ACL observed in the hosted ProjectVault project.
--
-- Existing application table grants are handled by the earlier table ACL
-- migration. Existing SECURITY DEFINER function grants are normalized below.
-- Future public tables, sequences, and functions must receive explicit grants
-- from their owning migration instead of inheriting API-role privileges.
--
-- This migration is scoped to the postgres migration owner. The current
-- migration session is postgres and all 14 application tables are postgres-owned;
-- it intentionally does not modify Supabase-managed supabase_admin defaults.

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- Match the hosted SECURITY DEFINER execution boundary. Trigger/internal
-- functions remain inaccessible to API roles; only the reviewed helper/RPC
-- allowlist is re-granted below.
DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      v_function.signature
    );
  END LOOP;
END;
$$;

-- Authenticated workspace helpers and explicitly authorized RPCs.
GRANT EXECUTE ON FUNCTION public.change_workspace_member_role_atomic(text, uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_workspace_atomic(text, text, text, text, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_workspace_atomic(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(text, text[])
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_authenticated_non_demo()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_demo_workspace(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership_atomic(text, uuid, text, uuid)
  TO authenticated, service_role;

-- Server-only RPCs.
GRANT EXECUTE ON FUNCTION public.broadcast_workspace_delete()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_workspace_invite_by_hash_atomic(uuid, text)
  TO service_role;

COMMIT;
