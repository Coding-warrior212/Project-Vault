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

-- Direct owner deletion must be blocked; ownership must be transferred first.
-- Test the RLS policy as authenticated, then the trigger as a privileged SQL role
-- with a user identity set (simulating an RLS-bypass path).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$
DECLARE
  v_workspace text;
BEGIN
  SELECT id INTO v_workspace FROM public.workspaces WHERE code='INVREPLAY';
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'Owner guard workspace is missing'; END IF;

  DELETE FROM public.workspace_members
  WHERE workspace_id=v_workspace
    AND user_id='11111111-1111-4111-8111-111111111111';

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id=v_workspace
      AND user_id='11111111-1111-4111-8111-111111111111'
      AND role='owner'
  ) THEN
    RAISE EXCEPTION 'RLS allowed a direct owner self-delete';
  END IF;
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$
DECLARE
  v_workspace text;
  v_denied boolean := false;
BEGIN
  SELECT id INTO v_workspace FROM public.workspaces WHERE code='INVREPLAY';
  BEGIN
    DELETE FROM public.workspace_members
    WHERE workspace_id=v_workspace
      AND user_id='11111111-1111-4111-8111-111111111111';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'Owner membership trigger allowed direct deletion with RLS bypass';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id=v_workspace
      AND user_id='11111111-1111-4111-8111-111111111111'
      AND role='owner'
  ) THEN
    RAISE EXCEPTION 'Rejected owner deletion unexpectedly removed the membership';
  END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', '', false);

-- Ownership transfer is the authorized path and atomically demotes the old owner.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT * FROM public.transfer_workspace_ownership_atomic(
  (SELECT id FROM public.workspaces WHERE code='INVREPLAY'),
  '22222222-2222-4222-8222-222222222222',
  'admin',
  NULL
);
DO $$
DECLARE
  v_workspace text;
BEGIN
  SELECT id INTO v_workspace FROM public.workspaces WHERE code='INVREPLAY';
  IF (SELECT role FROM public.workspace_members WHERE workspace_id=v_workspace AND user_id='11111111-1111-4111-8111-111111111111') <> 'admin' THEN
    RAISE EXCEPTION 'Ownership transfer did not demote the previous owner';
  END IF;
  IF (SELECT role FROM public.workspace_members WHERE workspace_id=v_workspace AND user_id='22222222-2222-4222-8222-222222222222') <> 'owner' THEN
    RAISE EXCEPTION 'Ownership transfer did not promote the target owner';
  END IF;
END;
$$;
RESET ROLE;

-- Verify activity references are same-workspace at INSERT time and remain
-- immutable historical identifiers after the referenced source/claim are deleted.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$
DECLARE
  v_workspace text;
  v_foreign_source text;
  v_foreign_claim text;
BEGIN
  SELECT id INTO v_workspace FROM public.workspaces WHERE code='INVREPLAY';
  SELECT id INTO v_foreign_source FROM public.sources WHERE workspace_id='ws-apex' LIMIT 1;
  SELECT id INTO v_foreign_claim FROM public.claims WHERE workspace_id='ws-apex' LIMIT 1;

  IF v_workspace IS NULL OR v_foreign_source IS NULL OR v_foreign_claim IS NULL THEN
    RAISE EXCEPTION 'Activity reference test fixtures are missing';
  END IF;

  -- A claim in this workspace must never reference another workspace's source.
  BEGIN
    INSERT INTO public.claims (
      id,workspace_id,source_id,source_name,source_location,source_evidence_quote,
      statement,category,confidence_score,confidence_tier
    ) VALUES (
      'clm-cross-workspace-source-test',v_workspace,v_foreign_source,
      'foreign.txt','foreign.txt','Foreign evidence quote',
      'Cross-workspace source reference must be rejected',
      'Important Facts',90,'high'
    );

    RAISE EXCEPTION 'Cross-workspace claim/source reference was accepted';
  EXCEPTION WHEN SQLSTATE '23503' THEN
    NULL;
  END;

  INSERT INTO public.sources (id,workspace_id,title,type,filename)
  VALUES ('src-activity-ref-test',v_workspace,'Activity reference test','text','activity-ref.txt');

  INSERT INTO public.claims (
    id,workspace_id,source_id,source_name,source_location,source_evidence_quote,
    statement,category,confidence_score,confidence_tier
  ) VALUES (
    'clm-activity-ref-test',v_workspace,'src-activity-ref-test','activity-ref.txt',
    'activity-ref.txt','Evidence quote','A test claim for append-only activity references',
    'Important Facts',90,'high'
  );

  INSERT INTO public.activity_events (
    id,workspace_id,type,timestamp_label,title,description,actor,actor_source,source_id,claim_id
  ) VALUES (
    'act-activity-ref-valid',v_workspace,'source_ingested','Just now','Reference test',
    'Valid same-workspace activity reference','Untrusted display name','jwt',
    'src-activity-ref-test','clm-activity-ref-test'
  );

  BEGIN
    INSERT INTO public.activity_events (
      id,workspace_id,type,timestamp_label,title,description,actor,actor_source,source_id
    ) VALUES (
      'act-activity-ref-cross-source',v_workspace,'source_ingested','Just now','Invalid reference',
      'Cross-workspace source reference','Untrusted display name','jwt',v_foreign_source
    );
    RAISE EXCEPTION 'Cross-workspace source reference was accepted';
  EXCEPTION WHEN SQLSTATE '23503' THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.activity_events (
      id,workspace_id,type,timestamp_label,title,description,actor,actor_source,claim_id
    ) VALUES (
      'act-activity-ref-cross-claim',v_workspace,'claim_verified','Just now','Invalid reference',
      'Cross-workspace claim reference','Untrusted display name','jwt',v_foreign_claim
    );
    RAISE EXCEPTION 'Cross-workspace claim reference was accepted';
  EXCEPTION WHEN SQLSTATE '23503' THEN
    NULL;
  END;

  DELETE FROM public.sources
  WHERE workspace_id=v_workspace AND id='src-activity-ref-test';

  IF NOT EXISTS (
    SELECT 1 FROM public.activity_events
    WHERE id='act-activity-ref-valid'
      AND source_id='src-activity-ref-test'
      AND claim_id='clm-activity-ref-test'
  ) THEN
    RAISE EXCEPTION 'Deleting a source/claim rewrote the append-only activity reference';
  END IF;
END;
$$;

-- A former owner may leave after the atomic transfer; the new owner remains.
DO $$
DECLARE
  v_workspace text;
BEGIN
  SELECT id INTO v_workspace FROM public.workspaces WHERE code='INVREPLAY';
  DELETE FROM public.workspace_members
  WHERE workspace_id=v_workspace
    AND user_id='11111111-1111-4111-8111-111111111111';

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id=v_workspace
      AND user_id='11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'Former owner could not leave after transfer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id=v_workspace
      AND user_id='22222222-2222-4222-8222-222222222222'
      AND role='owner'
  ) THEN
    RAISE EXCEPTION 'Workspace lost its owner after former-owner departure';
  END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', '', false);
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
