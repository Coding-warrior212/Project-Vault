-- Harden trigger functions against mutable search_path resolution.
-- These functions use PostgreSQL built-ins and schema-qualified application objects.

ALTER FUNCTION public.prevent_workspace_transfer()
  SET search_path = '';

ALTER FUNCTION public.touch_updated_at()
  SET search_path = '';

ALTER FUNCTION public.touch_updated_at_and_version()
  SET search_path = '';

ALTER FUNCTION public.validate_workspace_claim_array()
  SET search_path = '';
