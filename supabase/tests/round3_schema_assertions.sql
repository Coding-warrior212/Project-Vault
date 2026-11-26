-- ProjectVault Round 3 post-migration schema assertions.
-- Run only against a disposable Supabase branch after applying the migration.
-- This script is read-only and raises an exception when a security invariant fails.

DO $$
DECLARE
  v_count integer;
  v_bad text;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname = ANY(ARRAY[
      'profiles','workspaces','workspace_members','workspace_invites','sources',
      'source_files','claims','conflicts','missing_info','questions','handovers',
      'activity_events','graph_nodes','graph_edges'
    ]);
  IF v_count <> 14 THEN RAISE EXCEPTION 'Expected 14 application tables, found %',v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname = ANY(ARRAY[
      'profiles','workspaces','workspace_members','workspace_invites','sources',
      'source_files','claims','conflicts','missing_info','questions','handovers',
      'activity_events','graph_nodes','graph_edges'
    ]) AND c.relrowsecurity;
  IF v_count <> 14 THEN RAISE EXCEPTION 'RLS must be enabled on all 14 tables; found %',v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname = ANY(ARRAY[
      'profiles','workspaces','workspace_members','workspace_invites','sources',
      'source_files','claims','conflicts','missing_info','questions','handovers',
      'activity_events','graph_nodes','graph_edges'
    ])
    AND has_table_privilege('anon',c.oid,'SELECT');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Anonymous role must not have SELECT on application tables; found %',v_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND cmd='SELECT' AND roles @> ARRAY['anon'::name]
  ) THEN
    RAISE EXCEPTION 'Anonymous role must not appear in application SELECT policies';
  END IF;

  IF has_schema_privilege('anon','private','USAGE')
     OR has_schema_privilege('authenticated','private','USAGE')
     OR has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'API roles must not have USAGE on private schema';
  END IF;

  IF has_table_privilege('anon','private.operation_capabilities','SELECT')
     OR has_table_privilege('authenticated','private.operation_capabilities','SELECT')
     OR has_table_privilege('service_role','private.operation_capabilities','SELECT')
     OR has_table_privilege('anon','private.operation_capabilities','INSERT')
     OR has_table_privilege('authenticated','private.operation_capabilities','INSERT')
     OR has_table_privilege('service_role','private.operation_capabilities','INSERT') THEN
    RAISE EXCEPTION 'API roles must not read or write operation capabilities';
  END IF;

  IF has_function_privilege('anon','private.grant_operation_capability(text,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','private.grant_operation_capability(text,uuid)','EXECUTE')
     OR has_function_privilege('service_role','private.grant_operation_capability(text,uuid)','EXECUTE')
     OR has_function_privilege('anon','private.has_operation_capability(text)','EXECUTE')
     OR has_function_privilege('authenticated','private.has_operation_capability(text)','EXECUTE')
     OR has_function_privilege('service_role','private.has_operation_capability(text)','EXECUTE') THEN
    RAISE EXCEPTION 'API roles must not execute private capability helpers';
  END IF;

  IF has_function_privilege('anon','public.redeem_workspace_invite_by_hash_atomic(uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.redeem_workspace_invite_by_hash_atomic(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.redeem_workspace_invite_by_hash_atomic(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Invite redemption RPC must be service_role-only';
  END IF;
  IF has_function_privilege('anon','public.is_authenticated_non_demo()','EXECUTE')
     OR has_function_privilege('anon','public.is_demo_workspace(text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.is_authenticated_non_demo()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.is_demo_workspace(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Auth/demo SECURITY DEFINER helper grants must exclude anon and preserve authenticated RLS execution';
  END IF;

  SELECT p.proname INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND has_function_privilege('anon',p.oid,'EXECUTE')
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Anonymous role must not execute public SECURITY DEFINER function %',v_bad;
  END IF;

  IF NOT has_function_privilege('authenticated','public.is_authenticated_non_demo()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.is_demo_workspace(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated RLS helper execution privileges are missing';
  END IF;

  SELECT p.proname INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND has_function_privilege('anon',p.oid,'EXECUTE')
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Anonymous role must not execute public SECURITY DEFINER function %',v_bad;
  END IF;


  SELECT p.proname INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind IN ('f','p')
    AND pg_get_functiondef(p.oid) ILIKE '%projectvault.%'
  LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Legacy forgeable projectvault custom setting remains in function %',v_bad; END IF;

  SELECT p.proname INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    )
  LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'SECURITY DEFINER function % has no fixed search_path',v_bad; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.activity_events'::regclass
      AND conname IN ('fk_activity_source','fk_activity_claim','activity_events_actor_user_id_fkey')
  ) THEN
    RAISE EXCEPTION 'Append-only activity references must not use ON DELETE SET NULL foreign keys';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='activity_events'
      AND t.tgname='trg_activity_events_validate_references' AND NOT t.tgisinternal
  ) THEN RAISE EXCEPTION 'Activity-event same-workspace reference validation trigger is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='workspace_invites'
      AND t.tgname='trg_workspace_invites_lifecycle' AND NOT t.tgisinternal
  ) THEN RAISE EXCEPTION 'Invite lifecycle trigger is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='projectvault-sources' AND public=false
  ) THEN RAISE EXCEPTION 'Private projectvault-sources bucket is missing or public'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='workspace_members'
      AND policyname='workspace_members_delete_policy'
      AND qual ILIKE '%role <> ''owner''%'
  ) THEN
    RAISE EXCEPTION 'Direct workspace-member DELETE policy must exclude owner rows';
  END IF;

  IF pg_get_functiondef('public.enforce_workspace_member_guards()'::regprocedure)
       NOT ILIKE '%OWNER_DELETE_REQUIRES_TRANSFER%' THEN
    RAISE EXCEPTION 'Membership trigger must require atomic ownership transfer before owner deletion';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='realtime'
      AND tablename='messages'
      AND policyname='users receive their own membership revocation broadcasts'
      AND qual ILIKE '%pv-membership-revoked:%'
  ) THEN
    RAISE EXCEPTION 'Private user-specific membership revocation policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='workspace_members'
      AND t.tgname='trg_broadcast_workspace_membership_revocation'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Workspace membership revocation broadcast trigger is missing';
  END IF;

  IF pg_get_functiondef('public.broadcast_workspace_membership_revocation()'::regprocedure)
       NOT ILIKE '%realtime.send%' THEN
    RAISE EXCEPTION 'Membership revocation trigger must send a targeted Realtime broadcast';
  END IF;

  -- Supabase's postgres-owned public defaults must not re-expose future
  -- application objects to API roles. The local bootstrap seeds these grants
  -- before migrations so this assertion verifies an actual revoke.
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole
      AND d.defaclnamespace = 'public'::regnamespace
      AND d.defaclobjtype IN ('r', 'S', 'f')
      AND a.grantee IN (
        'anon'::regrole,
        'authenticated'::regrole,
        'service_role'::regrole
      )
  ) THEN
    RAISE EXCEPTION 'Postgres public default ACLs must not grant tables, sequences, or functions to API roles';
  END IF;

  -- The hosted SECURITY DEFINER allowlist is intentional: internal trigger
  -- functions are not directly executable by API roles.
  SELECT p.proname INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND p.proname NOT IN (
      'change_workspace_member_role_atomic',
      'create_workspace_atomic',
      'delete_workspace_atomic',
      'get_workspace_role',
      'has_workspace_role',
      'is_authenticated_non_demo',
      'is_demo_workspace',
      'is_workspace_member',
      'transfer_workspace_ownership_atomic'
    )
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected authenticated SECURITY DEFINER execution grant on %', v_bad;
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.create_workspace_atomic(text,text,text,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.transfer_workspace_ownership_atomic(text,uuid,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users must retain the user-JWT workspace creation and ownership-transfer RPCs';
  END IF;

  IF has_function_privilege('service_role', 'public.create_workspace_atomic(text,text,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.transfer_workspace_ownership_atomic(text,uuid,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Service role must not execute workspace owner RPCs that accept caller-supplied actor IDs';
  END IF;

  SELECT p.proname INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('service_role', p.oid, 'EXECUTE')
    AND p.proname NOT IN (
      'broadcast_workspace_delete',
      'change_workspace_member_role_atomic',
      'get_workspace_role',
      'has_workspace_role',
      'is_authenticated_non_demo',
      'is_demo_workspace',
      'is_workspace_member',
      'redeem_workspace_invite_by_hash_atomic'
    )
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected service_role SECURITY DEFINER execution grant on %', v_bad;
  END IF;

  IF has_function_privilege('service_role', 'public.delete_workspace_atomic(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.broadcast_workspace_delete()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.broadcast_workspace_delete()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.broadcast_workspace_delete()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Workspace deletion/broadcast RPC grants do not match the reviewed role boundary';
  END IF;

  RAISE NOTICE 'ProjectVault Round 3 schema assertions passed.';
END;
$$;

-- Report the actual public schema grants and RLS policy count for reviewer inspection.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('profiles','workspaces','workspace_members','workspace_invites','sources',
    'source_files','claims','conflicts','missing_info','questions','handovers','activity_events','graph_nodes','graph_edges')
ORDER BY table_name,grantee,privilege_type;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename,policyname;
