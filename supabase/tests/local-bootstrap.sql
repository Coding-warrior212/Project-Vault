-- Minimal local stand-ins for Supabase-managed schemas.
-- This is ONLY for local PostgreSQL migration smoke tests; it is not a production replacement.

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Emulate the Supabase-managed default ACLs for objects created by the
-- postgres migration owner in public. The hardening migration must revoke
-- these inherited API-role grants; otherwise the local test would be vacuous.
-- PostgreSQL's built-in global function default grants EXECUTE to PUBLIC.
-- Seed it explicitly so the regression test proves the global revoke works.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'sub', '')
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  name text NOT NULL,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(p_name text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN cardinality(string_to_array(p_name, '/')) > 1
      THEN (string_to_array(p_name, '/'))[1:cardinality(string_to_array(p_name, '/')) - 1]
    ELSE ARRAY[]::text[]
  END;
$$;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;

-- Minimal Realtime stand-ins for disposable PostgreSQL migration tests.
-- These do NOT implement or validate the Supabase Realtime service.

CREATE SCHEMA IF NOT EXISTS realtime;

CREATE TABLE IF NOT EXISTS realtime.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic text NOT NULL,
  extension text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  event text NOT NULL DEFAULT '',
  private boolean NOT NULL DEFAULT true,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION realtime.topic()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('realtime.topic', true), '');
$$;

CREATE OR REPLACE FUNCTION realtime.send(
  payload jsonb,
  event text,
  topic text,
  private boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Record the attempted message so SQL tests can verify topic scoping and
  -- RLS policy shape. This does NOT implement WebSocket delivery.
  INSERT INTO realtime.messages (topic, extension, payload, event, private)
  VALUES (topic, 'broadcast', payload, event, private);
END;
$$;

GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT SELECT ON realtime.messages TO authenticated;
GRANT EXECUTE ON FUNCTION realtime.topic() TO authenticated;
