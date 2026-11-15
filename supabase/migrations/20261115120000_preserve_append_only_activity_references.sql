-- Preserve immutable activity-event references when source/claim/user records are removed.
--
-- activity_events is append-only: enforce_activity_events_trust rejects UPDATEs.
-- ON DELETE SET NULL foreign keys would internally UPDATE those immutable rows
-- when a source, claim, or Auth user is deleted, making the deletion fail.
--
-- Keep these identifiers as historical audit references. They intentionally
-- are not foreign keys. New source/claim references are validated at INSERT time
-- against the same workspace; after insertion, deleting the operational record
-- does not rewrite the immutable event.
ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS fk_activity_source;

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS fk_activity_claim;

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS activity_events_actor_user_id_fkey;

CREATE OR REPLACE FUNCTION public.validate_activity_event_references()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.source_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sources s
    WHERE s.workspace_id = NEW.workspace_id AND s.id = NEW.source_id
  ) THEN
    RAISE EXCEPTION 'ACTIVITY_SOURCE_REFERENCE_INVALID: source must belong to the same workspace'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.claim_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.workspace_id = NEW.workspace_id AND c.id = NEW.claim_id
  ) THEN
    RAISE EXCEPTION 'ACTIVITY_CLAIM_REFERENCE_INVALID: claim must belong to the same workspace'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_activity_event_references() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_activity_events_validate_references ON public.activity_events;
CREATE TRIGGER trg_activity_events_validate_references
  BEFORE INSERT ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_activity_event_references();
