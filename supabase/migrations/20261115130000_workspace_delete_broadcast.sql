-- Secure, minimal DELETE notifications for workspace Realtime subscribers.
-- Existing Postgres Changes subscriptions continue handling INSERT and UPDATE.

CREATE POLICY "workspace members receive private delete broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^pv-workspace:.+:(app|handover)$'
  AND COALESCE(
    public.is_workspace_member(
      substring(realtime.topic() FROM '^pv-workspace:(.*):(app|handover)$')
    ),
    false
  )
);

CREATE OR REPLACE FUNCTION public.broadcast_workspace_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, realtime
AS $$
DECLARE
  v_suffix text;
BEGIN
  FOREACH v_suffix IN ARRAY ARRAY['app', 'handover']::text[]
  LOOP
    PERFORM realtime.send(
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'id', OLD.id
      ),
      'workspace_delete',
      'pv-workspace:' || OLD.workspace_id || ':' || v_suffix,
      true
    );
  END LOOP;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_workspace_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_broadcast_workspace_delete
AFTER DELETE ON public.sources
FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_delete();

CREATE TRIGGER trg_broadcast_workspace_delete
AFTER DELETE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_delete();

CREATE TRIGGER trg_broadcast_workspace_delete
AFTER DELETE ON public.conflicts
FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_delete();

CREATE TRIGGER trg_broadcast_workspace_delete
AFTER DELETE ON public.missing_info
FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_delete();

CREATE TRIGGER trg_broadcast_workspace_delete
AFTER DELETE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_delete();

CREATE TRIGGER trg_broadcast_workspace_delete
AFTER DELETE ON public.handovers
FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_delete();
