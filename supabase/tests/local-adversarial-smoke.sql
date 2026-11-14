-- Local PostgreSQL smoke test. Supabase Auth/Storage are represented by local stubs.
-- This does NOT test PostgREST, managed Supabase roles, Auth, Realtime or Storage service behavior.

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.workspaces WHERE id='ws-apex' AND is_demo=true;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected seeded demo workspace'; END IF;

  SELECT count(*) INTO v_count FROM public.sources WHERE workspace_id='ws-apex';
  IF v_count < 1 THEN RAISE EXCEPTION 'Expected seeded demo sources'; END IF;

  SELECT count(*) INTO v_count FROM public.graph_edges WHERE workspace_id='ws-apex';
  IF v_count < 1 THEN RAISE EXCEPTION 'Expected seeded knowledge graph edges'; END IF;

  IF EXISTS (SELECT 1 FROM private.operation_capabilities WHERE transaction_id=pg_catalog.pg_current_xact_id()) THEN
    RAISE EXCEPTION 'Seed capability must be removed before migration commit';
  END IF;
END;
$$;

-- Verify a caller-settable GUC does not unlock demo writes, even for service_role.
SET ROLE service_role;
SELECT set_config('projectvault.seed_mode','on',false);
DO $$
BEGIN
  BEGIN
    UPDATE public.workspaces SET name='MUST NOT CHANGE' WHERE id='ws-apex';
    IF FOUND THEN RAISE EXCEPTION 'Demo workspace was modified using a forged seed GUC'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT name FROM public.workspaces WHERE id='ws-apex') <> 'Apex Autonomous Fleet OS' THEN
    RAISE EXCEPTION 'Demo workspace name changed unexpectedly';
  END IF;
END;
$$;

SELECT 'local migration smoke tests passed' AS result;
