-- Match the hosted Supabase function ACLs observed on 2026-11-22.
-- The Judge Demo is browser-local; anonymous callers do not need these public
-- SECURITY DEFINER helpers. Keep authenticated/service_role execution for RLS
-- and trusted server operations.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.is_authenticated_non_demo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_demo_workspace(text) FROM anon;

COMMIT;
