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


-- Verify invite redemption is idempotent after the final allowed use commits.
-- This simulates a client retry after a successful response was lost in transit.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'invite-owner@example.test', '{"full_name":"Invite Owner"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'invite-joiner@example.test', '{"full_name":"Invite Joiner"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT * FROM public.create_workspace_atomic(
  'Invite Replay Test', 'INVREPLAY', 'Local invite retry regression test',
  'Engineering Continuity', NULL
);
INSERT INTO public.workspace_invites (
  workspace_id, code_hash, code_prefix, granted_role, max_uses, expires_at
)
SELECT id, '02078f170fe5942c520e314f176e1406759f1cdc03801933a71da64e6b592ccb', 'PV-AB12', 'editor', 1, now() + interval '7 days'
FROM public.workspaces
WHERE code = 'INVREPLAY';
SELECT set_config('request.jwt.claim.sub', '', false);
RESET ROLE;

SET ROLE service_role;
DO $$
DECLARE
  v_first record;
  v_retry record;
  v_uses integer;
BEGIN
  SELECT * INTO v_first
  FROM public.redeem_workspace_invite_by_hash_atomic(
    '22222222-2222-4222-8222-222222222222',
    '02078f170fe5942c520e314f176e1406759f1cdc03801933a71da64e6b592ccb'
  );
  IF v_first.already_member IS DISTINCT FROM false OR v_first.granted_role <> 'editor' THEN
    RAISE EXCEPTION 'First invite redemption did not create the expected membership';
  END IF;

  SELECT * INTO v_retry
  FROM public.redeem_workspace_invite_by_hash_atomic(
    '22222222-2222-4222-8222-222222222222',
    '02078f170fe5942c520e314f176e1406759f1cdc03801933a71da64e6b592ccb'
  );
  IF v_retry.already_member IS DISTINCT FROM true OR v_retry.granted_role <> 'editor' THEN
    RAISE EXCEPTION 'Retry after final invite use must return existing membership';
  END IF;

  SELECT uses_count INTO v_uses
  FROM public.workspace_invites
  WHERE code_hash = '02078f170fe5942c520e314f176e1406759f1cdc03801933a71da64e6b592ccb';
  IF v_uses IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Invite retry must not increment uses_count again; found %', v_uses;
  END IF;
END;
$$;
RESET ROLE;

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
