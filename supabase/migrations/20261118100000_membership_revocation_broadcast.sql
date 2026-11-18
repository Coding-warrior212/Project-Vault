-- Send a private, user-targeted Realtime signal when a workspace membership is deleted.
-- This avoids relying on filtered Postgres DELETE payloads, which cannot reliably
-- expose user_id on an RLS-protected table.

BEGIN;

DROP POLICY IF EXISTS "users receive their own membership revocation broadcasts"
  ON realtime.messages;

CREATE POLICY "users receive their own membership revocation broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() = 'pv-membership-revoked:' || (SELECT auth.uid())::text
  );

CREATE OR REPLACE FUNCTION public.broadcast_workspace_membership_revocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, realtime
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'workspace_id', OLD.workspace_id
    ),
    'membership_revoked',
    'pv-membership-revoked:' || OLD.user_id::text,
    true
  );

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_workspace_membership_revocation()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_broadcast_workspace_membership_revocation
  ON public.workspace_members;

CREATE TRIGGER trg_broadcast_workspace_membership_revocation
  AFTER DELETE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_workspace_membership_revocation();

COMMIT;
