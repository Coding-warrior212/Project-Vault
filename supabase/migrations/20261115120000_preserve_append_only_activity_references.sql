-- Preserve immutable activity-event references when source/claim records are removed.
--
-- activity_events is append-only: enforce_activity_events_trust rejects UPDATEs.
-- ON DELETE SET NULL foreign keys from activity_events would internally UPDATE
-- those immutable rows when a source (and its cascading claims) is deleted,
-- making otherwise-authorized source deletion fail with ACTIVITY_APPEND_ONLY.
--
-- Keep source_id and claim_id as historical identifiers in the event snapshot.
-- They intentionally are not foreign keys; the activity event remains intact
-- and auditable after the referenced operational record is removed.
ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS fk_activity_source;

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS fk_activity_claim;
