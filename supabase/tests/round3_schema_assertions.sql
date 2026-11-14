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

  SELECT p.proname INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind IN ('f','p')
    AND pg_get_functiondef(p.oid) ILIKE '%projectvault.seed_mode%'
  LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Legacy forgeable seed GUC remains in function %',v_bad; END IF;

  SELECT p.proname INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    )
  LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'SECURITY DEFINER function % has no fixed search_path',v_bad; END IF;

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
