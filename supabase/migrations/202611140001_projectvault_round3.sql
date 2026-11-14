-- ProjectVault Round 3 schema migration.
-- Derived from the reviewed architecture specification.
-- Hardening: transaction-bound private capabilities replace caller-settable GUC bypasses.
-- STATUS: DRAFT — NOT YET EXECUTED OR VALIDATED ON A DISPOSABLE DATABASE.
-- Do not apply to production until disposable Supabase tests pass.
BEGIN;

-- ============================================================================
-- ProjectVault Round 3 — Complete Supabase PostgreSQL Schema, RBAC, Triggers,
-- Storage, Realtime & Verified Judge Demo Seed (ws-apex)
-- Target Engine: PostgreSQL 15+ (Supabase)
-- Status: Static design specification (NOT YET EXECUTED)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: PREFLIGHT CHECKS & EXTENSIONS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'PostgreSQL 15+ is required for column-scoped ON DELETE SET NULL (column). Found: %',
      current_setting('server_version');
  END IF;

  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Supabase auth.users table not found. Run this script in a Supabase project.';
  END IF;

  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Supabase storage schema not found. Enable Supabase Storage before running.';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE IF NOT EXISTS private.operation_capabilities(
 transaction_id xid8 NOT NULL, operation text NOT NULL CHECK(operation IN('seed','owner_management','system_event','claim_cleanup','invite_redeem','invite_revoke')),
 actor_id uuid, PRIMARY KEY(transaction_id,operation));
ALTER TABLE private.operation_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.operation_capabilities FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.has_operation_capability(p_operation text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,private AS $
 SELECT EXISTS(SELECT 1 FROM private.operation_capabilities c WHERE c.transaction_id=pg_catalog.pg_current_xact_id() AND c.operation=p_operation);
$;
CREATE OR REPLACE FUNCTION private.operation_actor(p_operation text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,private AS $
 SELECT c.actor_id FROM private.operation_capabilities c WHERE c.transaction_id=pg_catalog.pg_current_xact_id() AND c.operation=p_operation;
$;
CREATE OR REPLACE FUNCTION private.grant_operation_capability(p_operation text,p_actor_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $
BEGIN
 IF p_operation NOT IN('seed','owner_management','system_event','claim_cleanup','invite_redeem','invite_revoke') THEN RAISE EXCEPTION 'Unsupported internal capability' USING ERRCODE='42501'; END IF;
 INSERT INTO private.operation_capabilities(transaction_id,operation,actor_id) VALUES(pg_catalog.pg_current_xact_id(),p_operation,p_actor_id) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM private.operation_capabilities c WHERE c.transaction_id=pg_catalog.pg_current_xact_id() AND c.operation=p_operation AND c.actor_id IS NOT DISTINCT FROM p_actor_id) THEN
  RAISE EXCEPTION 'Conflicting internal capability actor' USING ERRCODE='42501';
 END IF;
END; $;
REVOKE ALL ON FUNCTION private.has_operation_capability(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.operation_actor(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.grant_operation_capability(text,uuid) FROM PUBLIC,anon,authenticated,service_role;


-- ----------------------------------------------------------------------------
-- SECTION 2: TABLES, COMPOSITE KEYS & INDEXES
-- ----------------------------------------------------------------------------

-- 1. User profiles synced from auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text NOT NULL DEFAULT '',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Workspaces (shared team workspaces + read-only Judge Demo workspace)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id                    text PRIMARY KEY DEFAULT ('ws-' || substr(gen_random_uuid()::text, 1, 12)),
  name                  text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  code                  text NOT NULL CHECK (char_length(btrim(code)) BETWEEN 2 AND 24),
  description           text NOT NULL DEFAULT '',
  project_type          text NOT NULL DEFAULT 'Engineering Continuity',
  is_demo               boolean NOT NULL DEFAULT false,
  confidence_threshold  integer NOT NULL DEFAULT 70 CHECK (confidence_threshold BETWEEN 0 AND 100),
  conflict_sensitivity  text NOT NULL DEFAULT 'balanced' CHECK (conflict_sensitivity IN ('strict', 'balanced', 'relaxed')),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_workspaces_demo_creator CHECK (is_demo = false OR created_by IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_is_demo ON public.workspaces (is_demo);

-- 3. Workspace Invites (created before composite FK from workspace_members)
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code_hash     text NOT NULL UNIQUE,
  code_prefix   text NOT NULL,
  granted_role  text NOT NULL DEFAULT 'editor' CHECK (granted_role IN ('admin', 'editor', 'reviewer', 'viewer')),
  max_uses      integer NOT NULL DEFAULT 1 CHECK (max_uses >= 1 AND max_uses <= 100),
  uses_count    integer NOT NULL DEFAULT 0 CHECK (uses_count >= 0 AND uses_count <= max_uses),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  revoked_at    timestamptz,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_invites_ws_id UNIQUE (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_ws ON public.workspace_invites (workspace_id);

-- 4. Workspace Memberships (5-role RBAC + composite workspace-safe invite FK)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                  text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'reviewer', 'viewer')),
  joined_via_invite_id  uuid,
  added_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_members_ws_user UNIQUE (workspace_id, user_id),
  CONSTRAINT fk_workspace_members_invite
    FOREIGN KEY (workspace_id, joined_via_invite_id)
    REFERENCES public.workspace_invites(workspace_id, id)
    ON DELETE SET NULL (joined_via_invite_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_role ON public.workspace_members (workspace_id, role);

-- 5. Sources (uploaded PDF/MD/TXT and live GitHub snapshots)
CREATE TABLE IF NOT EXISTS public.sources (
  id                  text PRIMARY KEY DEFAULT ('src-' || substr(gen_random_uuid()::text, 1, 12)),
  workspace_id        text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title               text NOT NULL CHECK (char_length(btrim(title)) >= 1),
  type                text NOT NULL CHECK (type IN ('pdf', 'markdown', 'text', 'github')),
  filename            text NOT NULL,
  size_display        text NOT NULL DEFAULT '0 KB',
  size_bytes          bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  ingested_at_label   text NOT NULL DEFAULT 'Just now',
  claims_count        integer NOT NULL DEFAULT 0 CHECK (claims_count >= 0),
  status              text NOT NULL DEFAULT 'ingested' CHECK (status IN ('ingested', 'parsing', 'needs_review', 'error')),
  extraction_status   text NOT NULL DEFAULT 'success' CHECK (extraction_status IN ('success', 'empty', 'unsupported_scanned', 'failed', 'pending')),
  reconstruct_status  text NOT NULL DEFAULT 'not_started' CHECK (reconstruct_status IN ('not_started', 'processing', 'completed', 'failed')),
  reconstructed_at    timestamptz,
  author              text NOT NULL DEFAULT '',
  repo_branch         text,
  github_owner        text,
  github_repo         text,
  github_url          text,
  commit_sha          text,
  last_synced_at      timestamptz,
  summary             text NOT NULL DEFAULT '',
  raw_excerpt         text NOT NULL DEFAULT '',
  extracted_text      text,
  pages               jsonb,
  page_count          integer CHECK (page_count IS NULL OR page_count >= 0),
  char_count          integer CHECK (char_count IS NULL OR char_count >= 0),
  word_count          integer CHECK (word_count IS NULL OR word_count >= 0),
  error_message       text,
  content_hash        text,
  is_user_uploaded    boolean NOT NULL DEFAULT false,
  mime_type           text,
  tags                text[] NOT NULL DEFAULT '{}',
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version             integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sources_ws_id UNIQUE (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sources_ws_created ON public.sources (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_ws_hash ON public.sources (workspace_id, content_hash);

-- 6. Private Source File Metadata (references Supabase Storage objects)
CREATE TABLE IF NOT EXISTS public.source_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id       text NOT NULL,
  storage_bucket  text NOT NULL DEFAULT 'projectvault-sources' CHECK (storage_bucket = 'projectvault-sources'),
  storage_path    text NOT NULL UNIQUE,
  filename        text NOT NULL,
  mime_type       text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes      bigint NOT NULL CHECK (size_bytes >= 0),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_source_files_source
    FOREIGN KEY (workspace_id, source_id)
    REFERENCES public.sources(workspace_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_files_ws_source ON public.source_files (workspace_id, source_id);

-- 7. Knowledge Claims (split into content/evidence vs human review/verification fields)
CREATE TABLE IF NOT EXISTS public.claims (
  id                        text PRIMARY KEY DEFAULT ('CLM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  workspace_id              text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id                 text NOT NULL,
  source_name               text NOT NULL,
  source_location           text NOT NULL,
  source_evidence_quote     text NOT NULL,
  source_locator            jsonb,
  page_number               integer CHECK (page_number IS NULL OR page_number >= 1),
  char_offset_start         integer CHECK (char_offset_start IS NULL OR char_offset_start >= 0),
  char_offset_end           integer CHECK (char_offset_end IS NULL OR char_offset_end >= 0),
  evidence_grounded         boolean NOT NULL DEFAULT false,
  statement                 text NOT NULL CHECK (char_length(btrim(statement)) >= 1),
  category                  text NOT NULL CHECK (category IN (
                              'Architecture', 'Infrastructure', 'Security', 'Business Logic',
                              'Dependencies', 'Technical Decisions', 'Project Requirements',
                              'System Components', 'Tasks & Action Items', 'Risks & Blockers',
                              'Constraints', 'Important Facts', 'Unresolved Questions',
                              'Operational Procedures'
                            )),
  confidence_score          integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  confidence_tier           text NOT NULL CHECK (confidence_tier IN ('high', 'moderate', 'low')),
  confidence_rationale      text,
  importance                text NOT NULL DEFAULT 'standard' CHECK (importance IN ('critical', 'high', 'standard')),
  ai_explanation            text,
  is_user_extracted         boolean NOT NULL DEFAULT false,
  extraction_timestamp      timestamptz,
  extracted_at_label        text,
  verification_status       text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'conflicted', 'rejected')),
  conflicting_evidence      jsonb,
  human_review_notes        text,
  last_reviewed_by          text,
  last_reviewed_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_reviewed_at          text,
  is_flagged                boolean NOT NULL DEFAULT false,
  flagged_at                text,
  flagged_by                text,
  flagged_by_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  flag_reason               text,
  stale_reason              text,
  created_by                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version                   integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_claims_ws_id UNIQUE (workspace_id, id),
  CONSTRAINT fk_claims_source
    FOREIGN KEY (workspace_id, source_id)
    REFERENCES public.sources(workspace_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_claims_ws_status ON public.claims (workspace_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_claims_ws_source ON public.claims (workspace_id, source_id);

-- 8. Project Conflicts
CREATE TABLE IF NOT EXISTS public.conflicts (
  id                    text PRIMARY KEY DEFAULT ('CONF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  workspace_id          text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text NOT NULL,
  related_claim_ids     text[] NOT NULL DEFAULT '{}',
  supporting_evidence   text[] NOT NULL DEFAULT '{}',
  source_references     text[] NOT NULL DEFAULT '{}',
  severity              text NOT NULL CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_note         text,
  resolved_by_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at           timestamptz,
  is_ai_detected        boolean NOT NULL DEFAULT false,
  detected_at           timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version               integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_ws_status ON public.conflicts (workspace_id, status);

-- 9. Missing Information Findings
CREATE TABLE IF NOT EXISTS public.missing_info (
  id                    text PRIMARY KEY DEFAULT ('MISS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  workspace_id          text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category              text NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  why_it_matters        text NOT NULL,
  supporting_claim_ids  text[] NOT NULL DEFAULT '{}',
  severity              text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  action_suggestion     text,
  resolved_by_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at           timestamptz,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version               integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missing_info_ws_status ON public.missing_info (workspace_id, status);

-- 10. Unresolved Questions
CREATE TABLE IF NOT EXISTS public.questions (
  id                   text PRIMARY KEY DEFAULT ('Q-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  workspace_id         text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  question             text NOT NULL,
  context              text NOT NULL,
  related_claim_ids    text[] NOT NULL DEFAULT '{}',
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'dismissed')),
  answer               text,
  answered_by          text,
  answered_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at          text,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version              integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_ws_status ON public.questions (workspace_id, status);

-- 11. Handover Dossier & Strict Human Signoff
CREATE TABLE IF NOT EXISTS public.handovers (
  id                   text PRIMARY KEY DEFAULT ('handover-' || substr(gen_random_uuid()::text, 1, 12)),
  workspace_id         text NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title                text NOT NULL,
  version_label        text NOT NULL DEFAULT '1.0-RC',
  target_audience      text NOT NULL DEFAULT 'Incoming Engineering & SRE Teams',
  executive_note       text NOT NULL DEFAULT '',
  final_comment        text NOT NULL DEFAULT '',
  checklist            jsonb NOT NULL DEFAULT '{"verified":false,"unverified":false,"conflicts":false,"missing":false,"evidence":false}'::jsonb,
  is_approved          boolean NOT NULL DEFAULT false,
  approved_by          text,
  approved_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at          timestamptz,
  invalidated_reason   text,
  version              integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 12. Append-Only Activity Audit Events
CREATE TABLE IF NOT EXISTS public.activity_events (
  id               text PRIMARY KEY DEFAULT ('act-' || substr(gen_random_uuid()::text, 1, 12)),
  workspace_id     text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN (
                     'source_ingested', 'claim_verified', 'conflict_detected',
                     'handover_drafted', 'claim_rejected', 'knowledge_reconstructed',
                     'claim_flagged', 'claim_unflagged',
                     'member_joined', 'member_role_changed', 'member_removed',
                     'ownership_transferred', 'handover_approved', 'handover_invalidated',
                     'github_synced', 'graph_rebuilt'
                   )),
  timestamp_label  text NOT NULL DEFAULT 'Just now',
  title            text NOT NULL,
  description      text NOT NULL,
  actor            text NOT NULL,
  actor_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_source     text NOT NULL CHECK (actor_source IN ('jwt', 'server_verified', 'system_trigger', 'system_seed')),
  claim_id         text,
  source_id        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_activity_claim
    FOREIGN KEY (workspace_id, claim_id)
    REFERENCES public.claims(workspace_id, id)
    ON DELETE SET NULL (claim_id),
  CONSTRAINT fk_activity_source
    FOREIGN KEY (workspace_id, source_id)
    REFERENCES public.sources(workspace_id, id)
    ON DELETE SET NULL (source_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_ws_created ON public.activity_events (workspace_id, created_at DESC);

-- 13. Knowledge Graph Nodes (Round 3 Feature 3)
CREATE TABLE IF NOT EXISTS public.graph_nodes (
  id            text PRIMARY KEY DEFAULT ('node-' || substr(gen_random_uuid()::text, 1, 12)),
  workspace_id  text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label         text NOT NULL,
  node_type     text NOT NULL CHECK (node_type IN ('source', 'claim', 'component', 'service', 'decision', 'risk', 'person')),
  source_id     text,
  claim_id      text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_graph_nodes_ws_id UNIQUE (workspace_id, id),
  CONSTRAINT fk_graph_nodes_source
    FOREIGN KEY (workspace_id, source_id)
    REFERENCES public.sources(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_graph_nodes_claim
    FOREIGN KEY (workspace_id, claim_id)
    REFERENCES public.claims(workspace_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_ws_type ON public.graph_nodes (workspace_id, node_type);

-- 14. Knowledge Graph Edges (Round 3 Feature 3)
CREATE TABLE IF NOT EXISTS public.graph_edges (
  id             text PRIMARY KEY DEFAULT ('edge-' || substr(gen_random_uuid()::text, 1, 12)),
  workspace_id   text NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  from_node_id   text NOT NULL,
  to_node_id     text NOT NULL,
  relation_type  text NOT NULL CHECK (relation_type IN ('extracted_from', 'depends_on', 'contradicts', 'governs', 'supersedes', 'mitigates', 'owned_by')),
  weight         numeric(4,2) NOT NULL DEFAULT 1.00,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_graph_edges_no_self_loop CHECK (from_node_id <> to_node_id),
  CONSTRAINT uq_graph_edges_unique UNIQUE (workspace_id, from_node_id, to_node_id, relation_type),
  CONSTRAINT fk_graph_edges_from
    FOREIGN KEY (workspace_id, from_node_id)
    REFERENCES public.graph_nodes(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_graph_edges_to
    FOREIGN KEY (workspace_id, to_node_id)
    REFERENCES public.graph_nodes(workspace_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_ws_from ON public.graph_edges (workspace_id, from_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_ws_to ON public.graph_edges (workspace_id, to_node_id);


-- ----------------------------------------------------------------------------
-- SECTION 3: AUTH & RBAC HELPER FUNCTIONS (SECURITY DEFINER, NO RECURSION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_authenticated_non_demo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

CREATE OR REPLACE FUNCTION public.is_demo_workspace(p_workspace_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
  SELECT COALESCE((SELECT w.is_demo FROM public.workspaces w WHERE w.id = p_workspace_id), false);
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
  SELECT CASE
    WHEN NOT public.is_authenticated_non_demo() THEN NULL
    WHEN public.is_demo_workspace(p_workspace_id) THEN NULL
    ELSE (
      SELECT wm.role
      FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
  SELECT public.get_workspace_role(p_workspace_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(p_workspace_id text, p_allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
  SELECT COALESCE(public.get_workspace_role(p_workspace_id) = ANY (p_allowed_roles), false);
$$;

REVOKE ALL ON FUNCTION public.is_authenticated_non_demo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_demo_workspace(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workspace_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_member(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_workspace_role(text, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_authenticated_non_demo() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_demo_workspace(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(text, text[]) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- SECTION 4: INTEGRITY, DEMO LOCK, OWNER SAFETY & FIELD-LEVEL RBAC TRIGGERS
-- ----------------------------------------------------------------------------

-- 4.1 Automatic updated_at + optimistic version bump helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at_and_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.version IS NOT DISTINCT FROM OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

-- 4.2 Prevent moving rows across workspaces
CREATE OR REPLACE FUNCTION public.prevent_workspace_transfer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'workspace_id is immutable after creation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 4.3 Hard Demo Workspace Immutability (enforced even for service_role / SUPABASE_SECRET_KEY)
CREATE OR REPLACE FUNCTION public.guard_demo_workspace_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_target_ws_id text;
  v_old_is_demo boolean := false;
  v_new_is_demo boolean := false;
BEGIN
  IF private.has_operation_capability('seed') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'workspaces' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      v_old_is_demo := COALESCE(OLD.is_demo, false);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      v_new_is_demo := COALESCE(NEW.is_demo, false);
    END IF;

    IF v_old_is_demo OR v_new_is_demo THEN
      RAISE EXCEPTION 'DEMO_WORKSPACE_IMMUTABLE: Demo workspaces are strictly read-only'
        USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_target_ws_id := OLD.workspace_id;
  ELSE
    v_target_ws_id := NEW.workspace_id;
  END IF;

  IF public.is_demo_workspace(v_target_ws_id) THEN
    RAISE EXCEPTION 'DEMO_WORKSPACE_IMMUTABLE: Mutations to demo workspace "%" are prohibited', v_target_ws_id
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4.4 Validate claim ID arrays belong strictly to the same workspace
CREATE OR REPLACE FUNCTION public.validate_workspace_claim_array()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_claim_ids text[];
  v_invalid_id text;
BEGIN
  IF TG_TABLE_NAME = 'conflicts' THEN
    v_claim_ids := NEW.related_claim_ids;
  ELSIF TG_TABLE_NAME = 'missing_info' THEN
    v_claim_ids := NEW.supporting_claim_ids;
  ELSIF TG_TABLE_NAME = 'questions' THEN
    v_claim_ids := NEW.related_claim_ids;
  ELSE
    v_claim_ids := '{}';
  END IF;

  IF v_claim_ids IS NOT NULL AND cardinality(v_claim_ids) > 0 THEN
    SELECT x INTO v_invalid_id
    FROM unnest(v_claim_ids) AS x
    WHERE NOT EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.workspace_id = NEW.workspace_id AND c.id = x
    )
    LIMIT 1;

    IF v_invalid_id IS NOT NULL THEN
      RAISE EXCEPTION 'Referenced claim "%" does not exist in workspace "%"', v_invalid_id, NEW.workspace_id
        USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4.5 Cleanup deleted claim references safely across conflicts, missing_info, questions
CREATE OR REPLACE FUNCTION public.cleanup_deleted_claim_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
BEGIN
  IF public.is_demo_workspace(OLD.workspace_id) AND NOT private.has_operation_capability('seed') THEN
    RETURN OLD;
  END IF;

  PERFORM private.grant_operation_capability('claim_cleanup',NULL);

  UPDATE public.conflicts
     SET related_claim_ids = array_remove(related_claim_ids, OLD.id)
   WHERE workspace_id = OLD.workspace_id
     AND OLD.id = ANY (related_claim_ids);

  UPDATE public.missing_info
     SET supporting_claim_ids = array_remove(supporting_claim_ids, OLD.id)
   WHERE workspace_id = OLD.workspace_id
     AND OLD.id = ANY (supporting_claim_ids);

  UPDATE public.questions
     SET related_claim_ids = array_remove(related_claim_ids, OLD.id)
   WHERE workspace_id = OLD.workspace_id
     AND OLD.id = ANY (related_claim_ids);

  DELETE FROM private.operation_capabilities WHERE transaction_id=pg_catalog.pg_current_xact_id() AND operation='claim_cleanup';
  RETURN OLD;
END;
$;

-- 4.6 Owner safety + member role-change field guards
CREATE OR REPLACE FUNCTION public.enforce_workspace_member_guards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_actor_role text;
  v_rpc_active boolean := private.has_operation_capability('owner_management');
BEGIN
  IF auth.uid() IS NULL AND NOT v_rpc_active AND NOT private.has_operation_capability('invite_redeem') THEN RAISE EXCEPTION 'MEMBERSHIP_TRUST_VIOLATION' USING ERRCODE='42501'; END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND auth.uid() IS NULL AND NOT v_rpc_active THEN RAISE EXCEPTION 'MEMBERSHIP_TRUST_VIOLATION' USING ERRCODE='42501'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'owner' AND NOT v_rpc_active THEN
      RAISE EXCEPTION 'OWNER_PROTECTION: Owner memberships can only be created via atomic workspace/transfer RPCs'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.joined_via_invite_id IS DISTINCT FROM OLD.joined_via_invite_id
       OR NEW.added_by IS DISTINCT FROM OLD.added_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Immutable membership columns cannot be modified' USING ERRCODE = '42501';
    END IF;

    IF (OLD.role = 'owner' OR NEW.role = 'owner') AND NOT v_rpc_active THEN
      RAISE EXCEPTION 'OWNER_PROTECTION: Owner role changes require transfer_workspace_ownership_atomic'
        USING ERRCODE = '42501';
    END IF;

    IF auth.uid() IS NOT NULL AND NOT v_rpc_active THEN
      v_actor_role := public.get_workspace_role(OLD.workspace_id);
      IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'INSUFFICIENT_ROLE: Only owner or admin may modify workspace memberships'
          USING ERRCODE = '42501';
      END IF;

      IF v_actor_role = 'admin' THEN
        IF OLD.user_id = auth.uid() THEN
          RAISE EXCEPTION 'ADMIN_PROTECTION: Admins cannot modify their own membership role'
            USING ERRCODE = '42501';
        END IF;
        IF OLD.role IN ('owner', 'admin') OR NEW.role IN ('owner', 'admin') THEN
          RAISE EXCEPTION 'ADMIN_PROTECTION: Admins cannot modify owners/admins or promote members to admin/owner'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF auth.uid() IS NOT NULL AND NOT v_rpc_active THEN
      v_actor_role := public.get_workspace_role(OLD.workspace_id);
      IF OLD.user_id <> auth.uid() THEN
        IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
          RAISE EXCEPTION 'INSUFFICIENT_ROLE: Insufficient role to remove another member'
            USING ERRCODE = '42501';
        END IF;
        IF v_actor_role = 'admin' AND OLD.role IN ('owner', 'admin') THEN
          RAISE EXCEPTION 'ADMIN_PROTECTION: Admins cannot remove owners or other admins'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Enforce at least one active owner whenever the non-demo workspace still exists
-- (Allows ON DELETE CASCADE when the workspace row itself is deleted)
CREATE OR REPLACE FUNCTION public.enforce_owner_minimum_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_ws_id text;
  v_ws_exists boolean;
  v_is_demo boolean;
  v_owner_count integer;
BEGIN
  v_ws_id := OLD.workspace_id;

  IF OLD.role <> 'owner' OR (TG_OP = 'UPDATE' AND NEW.role = 'owner') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT true, w.is_demo
    INTO v_ws_exists, v_is_demo
    FROM public.workspaces w
   WHERE w.id = v_ws_id;

  -- If parent workspace no longer exists (cascade delete) or is demo, allow completion
  IF NOT COALESCE(v_ws_exists, false) OR COALESCE(v_is_demo, false) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO v_owner_count
    FROM public.workspace_members wm
   WHERE wm.workspace_id = v_ws_id
     AND wm.role = 'owner';

  IF v_owner_count < 1 THEN
    RAISE EXCEPTION 'OWNER_PROTECTION: Workspace "%" must retain at least one active owner; transfer ownership before leaving or deleting the workspace',
      v_ws_id
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4.7 Field-Level RBAC: Claims
CREATE OR REPLACE FUNCTION public.enforce_claims_rbac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_role text;
  v_profile_name text;
BEGIN
  IF private.has_operation_capability('seed') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Client JWT enforcement (direct PostgREST calls)
  IF auth.uid() IS NOT NULL THEN
    v_role := public.get_workspace_role(COALESCE(NEW.workspace_id, OLD.workspace_id));
    IF v_role IS NULL OR v_role = 'viewer' THEN
      RAISE EXCEPTION 'RBAC_DENIED: Viewers and non-members cannot mutate claims' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
      IF v_role NOT IN ('owner', 'admin', 'editor') THEN
        RAISE EXCEPTION 'RBAC_DENIED: Reviewers cannot delete claims' USING ERRCODE = '42501';
      END IF;
      RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF v_role NOT IN ('owner', 'admin', 'editor') THEN
        RAISE EXCEPTION 'RBAC_DENIED: Only owner, admin, or editor may create claims' USING ERRCODE = '42501';
      END IF;

      NEW.created_by := auth.uid();
      IF v_role = 'editor' THEN
        -- Editors cannot pre-verify, reject, flag, or inject reviewer stamps
        NEW.verification_status := 'unverified';
        NEW.human_review_notes := NULL;
        NEW.last_reviewed_by := NULL;
        NEW.last_reviewed_by_user_id := NULL;
        NEW.last_reviewed_at := NULL;
        NEW.is_flagged := false;
        NEW.flagged_at := NULL;
        NEW.flagged_by := NULL;
        NEW.flagged_by_user_id := NULL;
        NEW.flag_reason := NULL;
      END IF;
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      -- Universal immutable columns
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
         OR NEW.source_id IS DISTINCT FROM OLD.source_id
         OR NEW.created_by IS DISTINCT FROM OLD.created_by
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'RBAC_DENIED: Immutable claim identity/source fields cannot change' USING ERRCODE = '42501';
      END IF;

      IF v_role = 'editor' THEN
        IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
           OR NEW.conflicting_evidence IS DISTINCT FROM OLD.conflicting_evidence
           OR NEW.human_review_notes IS DISTINCT FROM OLD.human_review_notes
           OR NEW.last_reviewed_by IS DISTINCT FROM OLD.last_reviewed_by
           OR NEW.last_reviewed_by_user_id IS DISTINCT FROM OLD.last_reviewed_by_user_id
           OR NEW.last_reviewed_at IS DISTINCT FROM OLD.last_reviewed_at
           OR NEW.is_flagged IS DISTINCT FROM OLD.is_flagged
           OR NEW.flagged_at IS DISTINCT FROM OLD.flagged_at
           OR NEW.flagged_by IS DISTINCT FROM OLD.flagged_by
           OR NEW.flagged_by_user_id IS DISTINCT FROM OLD.flagged_by_user_id
           OR NEW.flag_reason IS DISTINCT FROM OLD.flag_reason THEN
          RAISE EXCEPTION 'RBAC_DENIED: Editors cannot verify, reject, flag, or alter reviewer metadata on claims'
            USING ERRCODE = '42501';
        END IF;
      ELSIF v_role = 'reviewer' THEN
        IF NEW.source_name IS DISTINCT FROM OLD.source_name
           OR NEW.source_location IS DISTINCT FROM OLD.source_location
           OR NEW.source_evidence_quote IS DISTINCT FROM OLD.source_evidence_quote
           OR NEW.source_locator IS DISTINCT FROM OLD.source_locator
           OR NEW.page_number IS DISTINCT FROM OLD.page_number
           OR NEW.char_offset_start IS DISTINCT FROM OLD.char_offset_start
           OR NEW.char_offset_end IS DISTINCT FROM OLD.char_offset_end
           OR NEW.evidence_grounded IS DISTINCT FROM OLD.evidence_grounded
           OR NEW.statement IS DISTINCT FROM OLD.statement
           OR NEW.category IS DISTINCT FROM OLD.category
           OR NEW.confidence_score IS DISTINCT FROM OLD.confidence_score
           OR NEW.confidence_tier IS DISTINCT FROM OLD.confidence_tier
           OR NEW.confidence_rationale IS DISTINCT FROM OLD.confidence_rationale
           OR NEW.importance IS DISTINCT FROM OLD.importance
           OR NEW.ai_explanation IS DISTINCT FROM OLD.ai_explanation
           OR NEW.is_user_extracted IS DISTINCT FROM OLD.is_user_extracted
           OR NEW.extraction_timestamp IS DISTINCT FROM OLD.extraction_timestamp
           OR NEW.extracted_at_label IS DISTINCT FROM OLD.extracted_at_label THEN
          RAISE EXCEPTION 'RBAC_DENIED: Reviewers cannot alter original source evidence, quotes, or claim statements'
            USING ERRCODE = '42501';
        END IF;
      END IF;

      -- Bind reviewer & flagger identity to verified JWT user
      SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
        INTO v_profile_name
        FROM public.profiles p
       WHERE p.id = auth.uid();

      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
         OR NEW.human_review_notes IS DISTINCT FROM OLD.human_review_notes THEN
        NEW.last_reviewed_by_user_id := auth.uid();
        NEW.last_reviewed_by := COALESCE(v_profile_name, 'Authenticated Reviewer');
        NEW.last_reviewed_at := COALESCE(NULLIF(btrim(NEW.last_reviewed_at), ''), to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
      END IF;

      IF NEW.is_flagged IS DISTINCT FROM OLD.is_flagged AND NEW.is_flagged = true THEN
        NEW.flagged_by_user_id := auth.uid();
        NEW.flagged_by := COALESCE(v_profile_name, 'Authenticated Reviewer');
        NEW.flagged_at := COALESCE(NULLIF(btrim(NEW.flagged_at), ''), to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
      ELSIF NEW.is_flagged = false THEN
        NEW.flagged_by_user_id := NULL;
        NEW.flagged_by := NULL;
        NEW.flagged_at := NULL;
        NEW.flag_reason := NULL;
      END IF;

      RETURN NEW;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4.8 Field-Level RBAC: Conflicts, Missing Info, Questions
CREATE OR REPLACE FUNCTION public.enforce_conflicts_rbac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_role text;
BEGIN
  IF private.has_operation_capability('seed')
     OR private.has_operation_capability('claim_cleanup') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_role := public.get_workspace_role(COALESCE(NEW.workspace_id, OLD.workspace_id));
    IF v_role IS NULL OR v_role = 'viewer' THEN
      RAISE EXCEPTION 'RBAC_DENIED: Insufficient permissions on conflicts' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
      IF v_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'RBAC_DENIED: Only owner or admin may delete conflict records' USING ERRCODE = '42501';
      END IF;
      RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF v_role = 'editor' THEN
        NEW.status := 'open';
        NEW.resolved_note := NULL;
        NEW.resolved_by_user_id := NULL;
        NEW.resolved_at := NULL;
      END IF;
      NEW.created_by := auth.uid();
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Immutable conflict identity fields cannot change' USING ERRCODE = '42501';
      END IF;
      IF v_role NOT IN ('owner', 'admin', 'reviewer') THEN
        RAISE EXCEPTION 'RBAC_DENIED: Only owner, admin, or reviewer may resolve or modify conflicts' USING ERRCODE = '42501';
      END IF;
      IF NEW.status IN ('resolved', 'dismissed') AND OLD.status = 'open' THEN
        NEW.resolved_by_user_id := auth.uid();
        NEW.resolved_at := now();
      ELSIF NEW.status = 'open' THEN
        NEW.resolved_by_user_id := NULL;
        NEW.resolved_at := NULL;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_missing_info_rbac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_role text;
BEGIN
  IF private.has_operation_capability('seed')
     OR private.has_operation_capability('claim_cleanup') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_role := public.get_workspace_role(COALESCE(NEW.workspace_id, OLD.workspace_id));
    IF v_role IS NULL OR v_role = 'viewer' THEN
      RAISE EXCEPTION 'RBAC_DENIED: Insufficient permissions on missing_info' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
      IF v_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'RBAC_DENIED: Only owner or admin may delete missing_info findings' USING ERRCODE = '42501';
      END IF;
      RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF v_role = 'editor' THEN
        NEW.status := 'open';
        NEW.resolved_by_user_id := NULL;
        NEW.resolved_at := NULL;
      END IF;
      NEW.created_by := auth.uid();
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Immutable missing_info fields cannot change' USING ERRCODE = '42501';
      END IF;
      IF v_role = 'editor' AND (
        NEW.status IS DISTINCT FROM OLD.status
        OR NEW.resolved_by_user_id IS DISTINCT FROM OLD.resolved_by_user_id
        OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
      ) THEN
        RAISE EXCEPTION 'RBAC_DENIED: Editors cannot resolve or dismiss missing info findings' USING ERRCODE = '42501';
      END IF;
      IF v_role IN ('owner', 'admin', 'reviewer') AND NEW.status IN ('resolved', 'dismissed') AND OLD.status = 'open' THEN
        NEW.resolved_by_user_id := auth.uid();
        NEW.resolved_at := now();
      ELSIF NEW.status = 'open' THEN
        NEW.resolved_by_user_id := NULL;
        NEW.resolved_at := NULL;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_questions_rbac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_role text;
  v_profile_name text;
BEGIN
  IF private.has_operation_capability('seed')
     OR private.has_operation_capability('claim_cleanup') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_role := public.get_workspace_role(COALESCE(NEW.workspace_id, OLD.workspace_id));
    IF v_role IS NULL OR v_role = 'viewer' THEN
      RAISE EXCEPTION 'RBAC_DENIED: Insufficient permissions on questions' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
      IF v_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'RBAC_DENIED: Only owner or admin may delete questions' USING ERRCODE = '42501';
      END IF;
      RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF v_role = 'editor' THEN
        NEW.status := 'open';
        NEW.answer := NULL;
        NEW.answered_by := NULL;
        NEW.answered_by_user_id := NULL;
        NEW.answered_at := NULL;
      END IF;
      NEW.created_by := auth.uid();
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Immutable question fields cannot change' USING ERRCODE = '42501';
      END IF;
      IF v_role = 'editor' AND (
        NEW.status IS DISTINCT FROM OLD.status
        OR NEW.answer IS DISTINCT FROM OLD.answer
        OR NEW.answered_by IS DISTINCT FROM OLD.answered_by
        OR NEW.answered_by_user_id IS DISTINCT FROM OLD.answered_by_user_id
        OR NEW.answered_at IS DISTINCT FROM OLD.answered_at
      ) THEN
        RAISE EXCEPTION 'RBAC_DENIED: Editors cannot answer or dismiss unresolved questions' USING ERRCODE = '42501';
      END IF;

      IF v_role IN ('owner', 'admin', 'reviewer') AND NEW.status IN ('answered', 'dismissed') THEN
        SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
          INTO v_profile_name
          FROM public.profiles p
         WHERE p.id = auth.uid();
        NEW.answered_by_user_id := auth.uid();
        NEW.answered_by := COALESCE(v_profile_name, 'Authenticated Reviewer');
        NEW.answered_at := COALESCE(NULLIF(btrim(NEW.answered_at), ''), to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
      ELSIF NEW.status = 'open' THEN
        NEW.answered_by_user_id := NULL;
        NEW.answered_by := NULL;
        NEW.answered_at := NULL;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4.9 Field-Level RBAC & Strict 5-Item Signoff Validation: Handovers
CREATE OR REPLACE FUNCTION public.enforce_handovers_rbac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_role text;
  v_profile_name text;
  v_checklist_complete boolean;
BEGIN
  IF private.has_operation_capability('seed') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Immutable handover identity fields cannot change' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_role := public.get_workspace_role(OLD.workspace_id);
    IF v_role IS NULL OR v_role = 'viewer' THEN
      RAISE EXCEPTION 'RBAC_DENIED: Viewers cannot modify handover documents' USING ERRCODE = '42501';
    END IF;

    IF v_role = 'editor' THEN
      IF NEW.checklist IS DISTINCT FROM OLD.checklist
         OR NEW.final_comment IS DISTINCT FROM OLD.final_comment
         OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
         OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
         OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
         OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
        RAISE EXCEPTION 'RBAC_DENIED: Editors cannot modify signoff checklist, final comment, or approval state'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  v_checklist_complete :=
    COALESCE((NEW.checklist ->> 'verified')::boolean, false)
    AND COALESCE((NEW.checklist ->> 'unverified')::boolean, false)
    AND COALESCE((NEW.checklist ->> 'conflicts')::boolean, false)
    AND COALESCE((NEW.checklist ->> 'missing')::boolean, false)
    AND COALESCE((NEW.checklist ->> 'evidence')::boolean, false);

  -- Auto-invalidate prior approval if content/checklist changed while approved
  IF OLD.is_approved = true AND NEW.is_approved = true AND (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.version_label IS DISTINCT FROM OLD.version_label
    OR NEW.target_audience IS DISTINCT FROM OLD.target_audience
    OR NEW.executive_note IS DISTINCT FROM OLD.executive_note
    OR NEW.final_comment IS DISTINCT FROM OLD.final_comment
    OR NEW.checklist IS DISTINCT FROM OLD.checklist
    OR NOT v_checklist_complete
  ) THEN
    NEW.is_approved := false;
    NEW.approved_by := NULL;
    NEW.approved_by_user_id := NULL;
    NEW.approved_at := NULL;
    NEW.invalidated_reason := 'Handover dossier or checklist modified after prior approval';
    RETURN NEW;
  END IF;

  IF NEW.is_approved = true THEN
    IF NOT v_checklist_complete THEN
      RAISE EXCEPTION 'HANDOVER_APPROVAL_BLOCKED: All 5 handover checklist items must be checked before approval'
        USING ERRCODE = '23514';
    END IF;

    IF auth.uid() IS NOT NULL THEN
      SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
        INTO v_profile_name
        FROM public.profiles p
       WHERE p.id = auth.uid();
      NEW.approved_by_user_id := auth.uid();
      NEW.approved_by := COALESCE(NULLIF(btrim(NEW.approved_by), ''), v_profile_name);
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.approved_by, '')), '') IS NULL OR NEW.approved_by_user_id IS NULL THEN
      RAISE EXCEPTION 'HANDOVER_APPROVAL_BLOCKED: Non-empty approver name and verified user ID are required'
        USING ERRCODE = '23514';
    END IF;

    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.invalidated_reason := NULL;
  ELSIF NEW.is_approved = false AND OLD.is_approved = true THEN
    NEW.approved_by := NULL;
    NEW.approved_by_user_id := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 4.10 Activity Events Trust & Append-Only Enforcement
CREATE OR REPLACE FUNCTION public.enforce_activity_events_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_ws_exists boolean;
  v_profile_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'ACTIVITY_APPEND_ONLY: activity_events cannot be modified' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Allow ONLY when parent workspace is already deleted via ON DELETE CASCADE
    SELECT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = OLD.workspace_id)
      INTO v_ws_exists;
    IF v_ws_exists THEN
      RAISE EXCEPTION 'ACTIVITY_APPEND_ONLY: activity_events cannot be deleted directly' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'INSERT'
  IF private.has_operation_capability('seed') THEN
    NEW.actor_source := 'system_seed';
    RETURN NEW;
  END IF;

  IF private.has_operation_capability('system_event') THEN
    NEW.actor_user_id := private.operation_actor('system_event');
    NEW.actor_source := 'system_trigger';
    IF NEW.actor_user_id IS NOT NULL THEN SELECT COALESCE(NULLIF(btrim(p.full_name),''),p.email) INTO v_profile_name FROM public.profiles p WHERE p.id=NEW.actor_user_id; IF v_profile_name IS NOT NULL THEN NEW.actor:=v_profile_name; END IF; END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    -- Client JWT path: force trusted JWT user ID and profile display name
    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
      INTO v_profile_name
      FROM public.profiles p
     WHERE p.id = auth.uid();

    NEW.actor_user_id := auth.uid();
    NEW.actor := COALESCE(v_profile_name, 'Authenticated Member');
    NEW.actor_source := 'jwt';
    RETURN NEW;
  END IF;

  -- Service-role path (Express backend using SUPABASE_SECRET_KEY)
  IF NEW.actor_source <> 'server_verified' THEN
    RAISE EXCEPTION 'ACTIVITY_TRUST_VIOLATION: Service-role inserts must set actor_source = server_verified'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.actor_user_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_TRUST_VIOLATION: Service-role inserts require verified actor_user_id'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = NEW.workspace_id
      AND wm.user_id = NEW.actor_user_id
  ) THEN
    RAISE EXCEPTION 'ACTIVITY_TRUST_VIOLATION: actor_user_id "%" is not a member of workspace "%"',
      NEW.actor_user_id, NEW.workspace_id
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
    INTO v_profile_name
    FROM public.profiles p
   WHERE p.id = NEW.actor_user_id;

  IF v_profile_name IS NOT NULL THEN
    NEW.actor := v_profile_name;
  END IF;

  RETURN NEW;
END;
$$;

-- 4.11 Profile auto-provision trigger on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(COALESCE(NEW.email, 'User'), '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.enforce_workspace_invite_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth,storage AS $
DECLARE v_role text;
BEGIN
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'INVITE_TRUST_VIOLATION' USING ERRCODE='42501'; END IF;
  v_role:=public.get_workspace_role(NEW.workspace_id);
  IF v_role NOT IN('owner','admin') THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING ERRCODE='42501'; END IF;
  IF v_role='admin' AND NEW.granted_role='admin' THEN RAISE EXCEPTION 'ADMIN_PROTECTION' USING ERRCODE='42501'; END IF;
  NEW.created_by:=auth.uid(); NEW.uses_count:=0; NEW.revoked_at:=NULL; RETURN NEW;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.code_hash IS DISTINCT FROM OLD.code_hash OR NEW.code_prefix IS DISTINCT FROM OLD.code_prefix OR NEW.granted_role IS DISTINCT FROM OLD.granted_role OR NEW.max_uses IS DISTINCT FROM OLD.max_uses OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'INVITE_IMMUTABLE' USING ERRCODE='42501'; END IF;
  IF NEW.uses_count IS DISTINCT FROM OLD.uses_count AND (NOT private.has_operation_capability('invite_redeem') OR NEW.uses_count<>OLD.uses_count+1 OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN RAISE EXCEPTION 'INVITE_COUNTER_PROTECTED' USING ERRCODE='42501'; END IF;
  IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
   IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN RAISE EXCEPTION 'INVITE_REVOCATION_ONE_WAY' USING ERRCODE='42501'; END IF;
   IF auth.uid() IS NOT NULL THEN v_role:=public.get_workspace_role(OLD.workspace_id); IF v_role NOT IN('owner','admin') THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING ERRCODE='42501'; END IF;
   ELSIF NOT private.has_operation_capability('invite_revoke') THEN RAISE EXCEPTION 'INVITE_TRUST_VIOLATION' USING ERRCODE='42501'; END IF;
  END IF; RETURN NEW;
 END IF;
 RAISE EXCEPTION 'INVITE_DELETE_DISABLED' USING ERRCODE='42501';
END; $;

-- 4.12 Attach All Triggers cleanly (idempotent DROP + CREATE)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_workspaces_demo_lock ON public.workspaces;
CREATE TRIGGER trg_workspaces_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_members_demo_lock ON public.workspace_members;
CREATE TRIGGER trg_workspace_members_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_workspace_members_guards ON public.workspace_members;
CREATE TRIGGER trg_workspace_members_guards
  BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_member_guards();

DROP TRIGGER IF EXISTS trg_workspace_members_owner_min ON public.workspace_members;
CREATE TRIGGER trg_workspace_members_owner_min
  AFTER UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_minimum_after_change();

DROP TRIGGER IF EXISTS trg_workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER trg_workspace_members_updated_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_invites_demo_lock ON public.workspace_invites;
CREATE TRIGGER trg_workspace_invites_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();
DROP TRIGGER IF EXISTS trg_workspace_invites_lifecycle ON public.workspace_invites;
CREATE TRIGGER trg_workspace_invites_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_invites FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_invite_lifecycle();

DROP TRIGGER IF EXISTS trg_workspace_invites_no_ws_move ON public.workspace_invites;
CREATE TRIGGER trg_workspace_invites_no_ws_move
  BEFORE UPDATE ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_transfer();

DROP TRIGGER IF EXISTS trg_sources_demo_lock ON public.sources;
CREATE TRIGGER trg_sources_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_sources_no_ws_move ON public.sources;
CREATE TRIGGER trg_sources_no_ws_move
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_transfer();

DROP TRIGGER IF EXISTS trg_sources_updated_at ON public.sources;
CREATE TRIGGER trg_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_source_files_demo_lock ON public.source_files;
CREATE TRIGGER trg_source_files_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.source_files
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_claims_demo_lock ON public.claims;
CREATE TRIGGER trg_claims_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_claims_rbac ON public.claims;
CREATE TRIGGER trg_claims_rbac
  BEFORE INSERT OR UPDATE OR DELETE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_claims_rbac();

DROP TRIGGER IF EXISTS trg_claims_updated_at ON public.claims;
CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_claims_cleanup_refs ON public.claims;
CREATE TRIGGER trg_claims_cleanup_refs
  AFTER DELETE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_claim_refs();

DROP TRIGGER IF EXISTS trg_conflicts_demo_lock ON public.conflicts;
CREATE TRIGGER trg_conflicts_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.conflicts
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_conflicts_rbac ON public.conflicts;
CREATE TRIGGER trg_conflicts_rbac
  BEFORE INSERT OR UPDATE OR DELETE ON public.conflicts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conflicts_rbac();

DROP TRIGGER IF EXISTS trg_conflicts_claim_array ON public.conflicts;
CREATE TRIGGER trg_conflicts_claim_array
  BEFORE INSERT OR UPDATE ON public.conflicts
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_claim_array();

DROP TRIGGER IF EXISTS trg_conflicts_updated_at ON public.conflicts;
CREATE TRIGGER trg_conflicts_updated_at
  BEFORE UPDATE ON public.conflicts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_missing_info_demo_lock ON public.missing_info;
CREATE TRIGGER trg_missing_info_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.missing_info
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_missing_info_rbac ON public.missing_info;
CREATE TRIGGER trg_missing_info_rbac
  BEFORE INSERT OR UPDATE OR DELETE ON public.missing_info
  FOR EACH ROW EXECUTE FUNCTION public.enforce_missing_info_rbac();

DROP TRIGGER IF EXISTS trg_missing_info_claim_array ON public.missing_info;
CREATE TRIGGER trg_missing_info_claim_array
  BEFORE INSERT OR UPDATE ON public.missing_info
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_claim_array();

DROP TRIGGER IF EXISTS trg_missing_info_updated_at ON public.missing_info;
CREATE TRIGGER trg_missing_info_updated_at
  BEFORE UPDATE ON public.missing_info
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_questions_demo_lock ON public.questions;
CREATE TRIGGER trg_questions_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_questions_rbac ON public.questions;
CREATE TRIGGER trg_questions_rbac
  BEFORE INSERT OR UPDATE OR DELETE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_questions_rbac();

DROP TRIGGER IF EXISTS trg_questions_claim_array ON public.questions;
CREATE TRIGGER trg_questions_claim_array
  BEFORE INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_claim_array();

DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_handovers_demo_lock ON public.handovers;
CREATE TRIGGER trg_handovers_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_handovers_rbac ON public.handovers;
CREATE TRIGGER trg_handovers_rbac
  BEFORE UPDATE ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_handovers_rbac();

DROP TRIGGER IF EXISTS trg_handovers_updated_at ON public.handovers;
CREATE TRIGGER trg_handovers_updated_at
  BEFORE UPDATE ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_activity_events_demo_lock ON public.activity_events;
CREATE TRIGGER trg_activity_events_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_activity_events_trust ON public.activity_events;
CREATE TRIGGER trg_activity_events_trust
  BEFORE INSERT OR UPDATE OR DELETE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_events_trust();

DROP TRIGGER IF EXISTS trg_graph_nodes_demo_lock ON public.graph_nodes;
CREATE TRIGGER trg_graph_nodes_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.graph_nodes
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_graph_nodes_no_ws_move ON public.graph_nodes;
CREATE TRIGGER trg_graph_nodes_no_ws_move
  BEFORE UPDATE ON public.graph_nodes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_transfer();

DROP TRIGGER IF EXISTS trg_graph_nodes_updated_at ON public.graph_nodes;
CREATE TRIGGER trg_graph_nodes_updated_at
  BEFORE UPDATE ON public.graph_nodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_graph_edges_demo_lock ON public.graph_edges;
CREATE TRIGGER trg_graph_edges_demo_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.graph_edges
  FOR EACH ROW EXECUTE FUNCTION public.guard_demo_workspace_immutability();

DROP TRIGGER IF EXISTS trg_graph_edges_no_ws_move ON public.graph_edges;
CREATE TRIGGER trg_graph_edges_no_ws_move
  BEFORE UPDATE ON public.graph_edges
  FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_transfer();


-- ----------------------------------------------------------------------------
-- SECTION 5: ROW LEVEL SECURITY & EXPLICIT POLICIES (ALL 14 TABLES)
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_files       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_info       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handovers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_nodes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges        ENABLE ROW LEVEL SECURITY;

-- 5.1 profiles
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_authenticated_non_demo()
    AND (
      id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm_self
        JOIN public.workspace_members wm_target ON wm_target.workspace_id = wm_self.workspace_id
        WHERE wm_self.user_id = auth.uid()
          AND wm_target.user_id = profiles.id
          AND NOT public.is_demo_workspace(wm_self.workspace_id)
      )
    )
  );

DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
CREATE POLICY profiles_insert_policy ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_non_demo() AND id = auth.uid());

DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_authenticated_non_demo() AND id = auth.uid())
  WITH CHECK (public.is_authenticated_non_demo() AND id = auth.uid());

DROP POLICY IF EXISTS profiles_delete_policy ON public.profiles;
CREATE POLICY profiles_delete_policy ON public.profiles
  FOR DELETE TO authenticated
  USING (false);

-- 5.2 workspaces
DROP POLICY IF EXISTS workspaces_select_policy ON public.workspaces;
CREATE POLICY workspaces_select_policy ON public.workspaces
  FOR SELECT TO anon, authenticated
  USING (is_demo = true OR public.is_workspace_member(id));

DROP POLICY IF EXISTS workspaces_insert_policy ON public.workspaces;
CREATE POLICY workspaces_insert_policy ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (false); -- Must use create_workspace_atomic RPC

DROP POLICY IF EXISTS workspaces_update_policy ON public.workspaces;
CREATE POLICY workspaces_update_policy ON public.workspaces
  FOR UPDATE TO authenticated
  USING (NOT is_demo AND public.has_workspace_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (NOT is_demo AND public.has_workspace_role(id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS workspaces_delete_policy ON public.workspaces;
CREATE POLICY workspaces_delete_policy ON public.workspaces
  FOR DELETE TO authenticated
  USING (NOT is_demo AND public.has_workspace_role(id, ARRAY['owner']));

-- 5.3 workspace_members (never readable by anon/demo; admins cannot touch owners/admins)
DROP POLICY IF EXISTS workspace_members_select_policy ON public.workspace_members;
CREATE POLICY workspace_members_select_policy ON public.workspace_members
  FOR SELECT TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_members_insert_policy ON public.workspace_members;
CREATE POLICY workspace_members_insert_policy ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (false); -- Must use create_workspace_atomic / redeem_workspace_invite_by_hash_atomic

DROP POLICY IF EXISTS workspace_members_update_policy ON public.workspace_members;
CREATE POLICY workspace_members_update_policy ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    NOT public.is_demo_workspace(workspace_id)
    AND (
      public.has_workspace_role(workspace_id, ARRAY['owner'])
      OR (
        public.has_workspace_role(workspace_id, ARRAY['admin'])
        AND role NOT IN ('owner', 'admin')
        AND user_id <> auth.uid()
      )
    )
  )
  WITH CHECK (
    NOT public.is_demo_workspace(workspace_id)
    AND role <> 'owner'
    AND (
      public.has_workspace_role(workspace_id, ARRAY['owner'])
      OR (
        public.has_workspace_role(workspace_id, ARRAY['admin'])
        AND role IN ('editor', 'reviewer', 'viewer')
        AND user_id <> auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS workspace_members_delete_policy ON public.workspace_members;
CREATE POLICY workspace_members_delete_policy ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    NOT public.is_demo_workspace(workspace_id)
    AND (
      user_id = auth.uid()
      OR public.has_workspace_role(workspace_id, ARRAY['owner'])
      OR (public.has_workspace_role(workspace_id, ARRAY['admin']) AND role NOT IN ('owner', 'admin'))
    )
  );

-- 5.4 workspace_invites (owner & admin only; anon/demo/editor/reviewer/viewer denied)
DROP POLICY IF EXISTS workspace_invites_select_policy ON public.workspace_invites;
CREATE POLICY workspace_invites_select_policy ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS workspace_invites_insert_policy ON public.workspace_invites;
CREATE POLICY workspace_invites_insert_policy ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_demo_workspace(workspace_id)
    AND granted_role <> 'owner'
    AND (
      public.has_workspace_role(workspace_id, ARRAY['owner'])
      OR (public.has_workspace_role(workspace_id, ARRAY['admin']) AND granted_role IN ('editor', 'reviewer', 'viewer'))
    )
  );

DROP POLICY IF EXISTS workspace_invites_update_policy ON public.workspace_invites;
CREATE POLICY workspace_invites_update_policy ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND granted_role <> 'owner');

DROP POLICY IF EXISTS workspace_invites_delete_policy ON public.workspace_invites;
CREATE POLICY workspace_invites_delete_policy ON public.workspace_invites FOR DELETE TO authenticated USING(false);

-- 5.5 sources (reviewers & viewers strictly read-only)
DROP POLICY IF EXISTS sources_select_policy ON public.sources;
CREATE POLICY sources_select_policy ON public.sources
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS sources_insert_policy ON public.sources;
CREATE POLICY sources_insert_policy ON public.sources
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS sources_update_policy ON public.sources;
CREATE POLICY sources_update_policy ON public.sources
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS sources_delete_policy ON public.sources;
CREATE POLICY sources_delete_policy ON public.sources
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

-- 5.6 source_files (private storage metadata; never exposed to anon/demo)
DROP POLICY IF EXISTS source_files_select_policy ON public.source_files;
CREATE POLICY source_files_select_policy ON public.source_files
  FOR SELECT TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS source_files_insert_policy ON public.source_files;
CREATE POLICY source_files_insert_policy ON public.source_files
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS source_files_update_policy ON public.source_files;
CREATE POLICY source_files_update_policy ON public.source_files
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS source_files_delete_policy ON public.source_files;
CREATE POLICY source_files_delete_policy ON public.source_files
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

-- 5.7 claims (row policies + trigger enforce_claims_rbac handles column boundaries)
DROP POLICY IF EXISTS claims_select_policy ON public.claims;
CREATE POLICY claims_select_policy ON public.claims
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS claims_insert_policy ON public.claims;
CREATE POLICY claims_insert_policy ON public.claims
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS claims_update_policy ON public.claims;
CREATE POLICY claims_update_policy ON public.claims
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']));

DROP POLICY IF EXISTS claims_delete_policy ON public.claims;
CREATE POLICY claims_delete_policy ON public.claims
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

-- 5.8 conflicts
DROP POLICY IF EXISTS conflicts_select_policy ON public.conflicts;
CREATE POLICY conflicts_select_policy ON public.conflicts
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS conflicts_insert_policy ON public.conflicts;
CREATE POLICY conflicts_insert_policy ON public.conflicts
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']));

DROP POLICY IF EXISTS conflicts_update_policy ON public.conflicts;
CREATE POLICY conflicts_update_policy ON public.conflicts
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'reviewer']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'reviewer']));

DROP POLICY IF EXISTS conflicts_delete_policy ON public.conflicts;
CREATE POLICY conflicts_delete_policy ON public.conflicts
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- 5.9 missing_info
DROP POLICY IF EXISTS missing_info_select_policy ON public.missing_info;
CREATE POLICY missing_info_select_policy ON public.missing_info
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS missing_info_insert_policy ON public.missing_info;
CREATE POLICY missing_info_insert_policy ON public.missing_info
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']));

DROP POLICY IF EXISTS missing_info_update_policy ON public.missing_info;
CREATE POLICY missing_info_update_policy ON public.missing_info
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']));

DROP POLICY IF EXISTS missing_info_delete_policy ON public.missing_info;
CREATE POLICY missing_info_delete_policy ON public.missing_info
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- 5.10 questions
DROP POLICY IF EXISTS questions_select_policy ON public.questions;
CREATE POLICY questions_select_policy ON public.questions
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS questions_insert_policy ON public.questions;
CREATE POLICY questions_insert_policy ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']));

DROP POLICY IF EXISTS questions_update_policy ON public.questions;
CREATE POLICY questions_update_policy ON public.questions
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']));

DROP POLICY IF EXISTS questions_delete_policy ON public.questions;
CREATE POLICY questions_delete_policy ON public.questions
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- 5.11 handovers
DROP POLICY IF EXISTS handovers_select_policy ON public.handovers;
CREATE POLICY handovers_select_policy ON public.handovers
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS handovers_insert_policy ON public.handovers;
CREATE POLICY handovers_insert_policy ON public.handovers
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS handovers_update_policy ON public.handovers;
CREATE POLICY handovers_update_policy ON public.handovers
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer']));

DROP POLICY IF EXISTS handovers_delete_policy ON public.handovers;
CREATE POLICY handovers_delete_policy ON public.handovers
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner']));

-- 5.12 activity_events (strictly append-only for clients)
DROP POLICY IF EXISTS activity_events_select_policy ON public.activity_events;
CREATE POLICY activity_events_select_policy ON public.activity_events
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS activity_events_insert_policy ON public.activity_events;
CREATE POLICY activity_events_insert_policy ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_demo_workspace(workspace_id)
    AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor', 'reviewer'])
    AND actor_user_id = auth.uid()
    AND actor_source = 'jwt'
  );

DROP POLICY IF EXISTS activity_events_update_policy ON public.activity_events;
CREATE POLICY activity_events_update_policy ON public.activity_events
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS activity_events_delete_policy ON public.activity_events;
CREATE POLICY activity_events_delete_policy ON public.activity_events
  FOR DELETE TO authenticated
  USING (false);

-- 5.13 graph_nodes & graph_edges (read for all members/demo; write for owner/admin/editor)
DROP POLICY IF EXISTS graph_nodes_select_policy ON public.graph_nodes;
CREATE POLICY graph_nodes_select_policy ON public.graph_nodes
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS graph_nodes_insert_policy ON public.graph_nodes;
CREATE POLICY graph_nodes_insert_policy ON public.graph_nodes
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS graph_nodes_update_policy ON public.graph_nodes;
CREATE POLICY graph_nodes_update_policy ON public.graph_nodes
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS graph_nodes_delete_policy ON public.graph_nodes;
CREATE POLICY graph_nodes_delete_policy ON public.graph_nodes
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS graph_edges_select_policy ON public.graph_edges;
CREATE POLICY graph_edges_select_policy ON public.graph_edges
  FOR SELECT TO anon, authenticated
  USING (public.is_demo_workspace(workspace_id) OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS graph_edges_insert_policy ON public.graph_edges;
CREATE POLICY graph_edges_insert_policy ON public.graph_edges
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS graph_edges_update_policy ON public.graph_edges;
CREATE POLICY graph_edges_update_policy ON public.graph_edges
  FOR UPDATE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']))
  WITH CHECK (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));

DROP POLICY IF EXISTS graph_edges_delete_policy ON public.graph_edges;
CREATE POLICY graph_edges_delete_policy ON public.graph_edges
  FOR DELETE TO authenticated
  USING (NOT public.is_demo_workspace(workspace_id) AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']));


-- ----------------------------------------------------------------------------
-- SECTION 6: ATOMIC SECURITY DEFINER RPCs
-- ----------------------------------------------------------------------------

-- 6.1 Atomic Workspace Creation (prevents ownerless workspaces & spoofing)
CREATE OR REPLACE FUNCTION public.create_workspace_atomic(
  p_name         text,
  p_code         text,
  p_description  text DEFAULT '',
  p_project_type text DEFAULT 'Engineering Continuity',
  p_owner_id     uuid DEFAULT NULL
)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_caller_id uuid;
  v_profile_name text;
  v_workspace public.workspaces;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    v_caller_id := p_owner_id;
  ELSE
    IF NOT public.is_authenticated_non_demo() THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: Must sign in with a non-demo account to create a workspace' USING ERRCODE = '42501';
    END IF;
    v_caller_id := auth.uid();
  END IF;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'OWNER_REQUIRED: Missing owner user ID' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
    INTO v_profile_name
    FROM public.profiles p
   WHERE p.id = v_caller_id;

  IF v_profile_name IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile must exist before creating a workspace' USING ERRCODE = '23503';
  END IF;

  PERFORM private.grant_operation_capability('owner_management',v_caller_id);
  PERFORM private.grant_operation_capability('system_event',v_caller_id);

  INSERT INTO public.workspaces (name, code, description, project_type, is_demo, created_by)
  VALUES (btrim(p_name), upper(btrim(p_code)), COALESCE(p_description, ''), COALESCE(p_project_type, 'Engineering Continuity'), false, v_caller_id)
  RETURNING * INTO v_workspace;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, added_by)
  VALUES (v_workspace.id, v_caller_id, 'owner', v_caller_id);

  INSERT INTO public.handovers (workspace_id, title, version_label, executive_note)
  VALUES (
    v_workspace.id,
    v_workspace.name || ' — Handover Dossier',
    '1.0-RC',
    'Initial handover dossier for ' || v_workspace.name || '.'
  );

  INSERT INTO public.activity_events (
    workspace_id, type, timestamp_label, title, description, actor, actor_user_id, actor_source
  ) VALUES (
    v_workspace.id,
    'handover_drafted',
    'Just now',
    'Workspace Created: ' || v_workspace.name,
    'Initialized shared workspace (' || v_workspace.code || ') and draft handover package.',
    v_profile_name,
    v_caller_id,
    'system_trigger'
  );

  DELETE FROM private.operation_capabilities WHERE transaction_id=pg_catalog.pg_current_xact_id() AND operation IN('owner_management','system_event');
  RETURN v_workspace;
END;
$;

-- 6.2 Atomic Ownership Transfer (only current owner; blocks demo; locks rows)
CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership_atomic(
  p_workspace_id       text,
  p_target_user_id     uuid,
  p_demote_previous_to text DEFAULT 'admin',
  p_acting_owner_id    uuid DEFAULT NULL
)
RETURNS TABLE (new_owner_id uuid, previous_owner_id uuid, previous_owner_new_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_target_exists boolean;
  v_caller_name text;
  v_target_name text;
BEGIN
  IF p_demote_previous_to NOT IN ('admin', 'editor', 'reviewer', 'viewer') THEN
    RAISE EXCEPTION 'INVALID_DEMOTE_ROLE: Previous owner must be demoted to admin, editor, reviewer, or viewer'
      USING ERRCODE = '22023';
  END IF;

  IF public.is_demo_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'DEMO_WORKSPACE_IMMUTABLE: Cannot transfer ownership of demo workspace'
      USING ERRCODE = '42501';
  END IF;

  IF current_setting('role', true) = 'service_role' THEN
    v_caller_id := p_acting_owner_id;
  ELSE
    IF NOT public.is_authenticated_non_demo() THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: Must authenticate to transfer ownership' USING ERRCODE = '42501';
    END IF;
    v_caller_id := auth.uid();
  END IF;

  IF v_caller_id IS NULL OR v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'INVALID_TRANSFER_TARGET: Target user must be a distinct workspace member'
      USING ERRCODE = '22023';
  END IF;

  -- Lock all membership rows for this workspace deterministically
  PERFORM 1
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id
   ORDER BY wm.id
   FOR UPDATE;

  SELECT wm.role INTO v_caller_role
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'OWNER_ONLY: Only an active workspace owner can transfer ownership' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_target_user_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'TARGET_NOT_MEMBER: Target user must already be a member of workspace "%"', p_workspace_id
      USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(NULLIF(btrim(full_name), ''), email) INTO v_caller_name FROM public.profiles WHERE id = v_caller_id;
  SELECT COALESCE(NULLIF(btrim(full_name), ''), email) INTO v_target_name FROM public.profiles WHERE id = p_target_user_id;

  PERFORM private.grant_operation_capability('owner_management',v_caller_id);
  PERFORM private.grant_operation_capability('system_event',v_caller_id);

  UPDATE public.workspace_members
     SET role = 'owner'
   WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id;

  UPDATE public.workspace_members
     SET role = p_demote_previous_to
   WHERE workspace_id = p_workspace_id AND user_id = v_caller_id;

  INSERT INTO public.activity_events (
    workspace_id, type, timestamp_label, title, description, actor, actor_user_id, actor_source
  ) VALUES (
    p_workspace_id,
    'ownership_transferred',
    'Just now',
    'Workspace Ownership Transferred',
    COALESCE(v_caller_name, 'Owner') || ' transferred workspace ownership to ' || COALESCE(v_target_name, 'Member') || ' (previous owner set to ' || p_demote_previous_to || ').',
    COALESCE(v_caller_name, 'Owner'),
    v_caller_id,
    'system_trigger'
  );

  DELETE FROM private.operation_capabilities WHERE transaction_id=pg_catalog.pg_current_xact_id() AND operation IN('owner_management','system_event');
  RETURN QUERY SELECT p_target_user_id, v_caller_id, p_demote_previous_to;
END;
$;

-- 6.3 Atomic Invite Redemption (service_role only, called via rate-limited Express route)
CREATE OR REPLACE FUNCTION public.redeem_workspace_invite_by_hash_atomic(
  p_user_id    uuid,
  p_code_hash  text
)
RETURNS TABLE (workspace_id text, granted_role text, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_invite public.workspace_invites;
  v_existing_role text;
  v_profile_name text;
BEGIN
  IF p_user_id IS NULL OR NULLIF(btrim(COALESCE(p_code_hash, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_INVITE_PARAMS: user_id and code_hash are required' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_invite
    FROM public.workspace_invites wi
   WHERE wi.code_hash = p_code_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND: Invite code is invalid' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_demo_workspace(v_invite.workspace_id) THEN
    RAISE EXCEPTION 'DEMO_WORKSPACE_IMMUTABLE: Invites cannot target a demo workspace' USING ERRCODE = '42501';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE_REVOKED: This invite code has been revoked' USING ERRCODE = '42501';
  END IF;

  IF v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED: This invite code has expired' USING ERRCODE = '42501';
  END IF;

  IF v_invite.uses_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'INVITE_EXHAUSTED: This invite code has reached its maximum uses' USING ERRCODE = '42501';
  END IF;

  IF v_invite.granted_role = 'owner' THEN
    RAISE EXCEPTION 'OWNER_PROTECTION: Invite codes can never grant owner role' USING ERRCODE = '42501';
  END IF;

  SELECT wm.role INTO v_existing_role
    FROM public.workspace_members wm
   WHERE wm.workspace_id = v_invite.workspace_id AND wm.user_id = p_user_id;

  IF v_existing_role IS NOT NULL THEN
    RETURN QUERY SELECT v_invite.workspace_id, v_existing_role, true;
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
    INTO v_profile_name
    FROM public.profiles p
   WHERE p.id = p_user_id;

  PERFORM private.grant_operation_capability('system_event',p_user_id);
  PERFORM private.grant_operation_capability('invite_redeem',p_user_id);

  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_via_invite_id, added_by)
  VALUES (v_invite.workspace_id, p_user_id, v_invite.granted_role, v_invite.id, v_invite.created_by);

  UPDATE public.workspace_invites
     SET uses_count = uses_count + 1
   WHERE id = v_invite.id;

  INSERT INTO public.activity_events (
    workspace_id, type, timestamp_label, title, description, actor, actor_user_id, actor_source
  ) VALUES (
    v_invite.workspace_id,
    'member_joined',
    'Just now',
    'Team Member Joined Workspace',
    COALESCE(v_profile_name, 'Team Member') || ' joined via invite (' || v_invite.code_prefix || '…) as ' || v_invite.granted_role || '.',
    COALESCE(v_profile_name, 'Team Member'),
    p_user_id,
    'system_trigger'
  );

  DELETE FROM private.operation_capabilities WHERE transaction_id=pg_catalog.pg_current_xact_id() AND operation IN('invite_redeem','system_event');
  RETURN QUERY SELECT v_invite.workspace_id, v_invite.granted_role, false;
END;
$;

REVOKE ALL ON FUNCTION public.create_workspace_atomic(text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_atomic(text, text, text, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transfer_workspace_ownership_atomic(text, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership_atomic(text, uuid, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_workspace_invite_by_hash_atomic(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_workspace_invite_by_hash_atomic(uuid, text) TO service_role;


-- ----------------------------------------------------------------------------
-- SECTION 7: PRIVATE STORAGE BUCKET & STORAGE RLS POLICIES
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'projectvault-sources',
  'projectvault-sources',
  false,
  52428800,
  ARRAY['application/pdf', 'text/markdown', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path format: <workspace_id>/<source_id>/<filename>
DROP POLICY IF EXISTS pv_storage_select_policy ON storage.objects;
CREATE POLICY pv_storage_select_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'projectvault-sources'
    AND NOT public.is_demo_workspace((storage.foldername(name))[1])
    AND public.is_workspace_member((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS pv_storage_insert_policy ON storage.objects;
CREATE POLICY pv_storage_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'projectvault-sources'
    AND NOT public.is_demo_workspace((storage.foldername(name))[1])
    AND public.has_workspace_role((storage.foldername(name))[1], ARRAY['owner', 'admin', 'editor'])
  );

DROP POLICY IF EXISTS pv_storage_update_policy ON storage.objects;
CREATE POLICY pv_storage_update_policy ON storage.objects
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS pv_storage_delete_policy ON storage.objects;
CREATE POLICY pv_storage_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'projectvault-sources'
    AND NOT public.is_demo_workspace((storage.foldername(name))[1])
    AND public.has_workspace_role((storage.foldername(name))[1], ARRAY['owner', 'admin', 'editor'])
  );


-- ----------------------------------------------------------------------------
-- SECTION 8: IDEMPOTENT REALTIME PUBLICATION SETUP
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'workspaces', 'workspace_members', 'sources', 'claims',
    'conflicts', 'missing_info', 'questions', 'handovers',
    'activity_events', 'graph_nodes', 'graph_edges'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END
$$;


-- ----------------------------------------------------------------------------
-- SECTION 9: VERIFIED JUDGE DEMO SEED DATA (ws-apex)
-- Scoped inside a transaction with seed_mode = 'on'; automatically locked after COMMIT
-- ----------------------------------------------------------------------------

INSERT INTO private.operation_capabilities(transaction_id,operation,actor_id) VALUES(pg_catalog.pg_current_xact_id(),'seed',NULL) ON CONFLICT DO NOTHING;


REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public.profiles,public.workspaces,public.workspace_members,public.workspace_invites,public.sources,public.source_files,public.claims,public.conflicts,public.missing_info,public.questions,public.handovers,public.activity_events,public.graph_nodes,public.graph_edges FROM anon,authenticated,service_role;
GRANT SELECT ON TABLE public.profiles,public.workspaces,public.workspace_members,public.workspace_invites,public.sources,public.source_files,public.claims,public.conflicts,public.missing_info,public.questions,public.handovers,public.activity_events,public.graph_nodes,public.graph_edges TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.profiles,public.workspaces,public.workspace_members,public.workspace_invites,public.sources,public.source_files,public.claims,public.conflicts,public.missing_info,public.questions,public.handovers,public.activity_events,public.graph_nodes,public.graph_edges TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles,public.workspaces,public.workspace_members,public.workspace_invites,public.sources,public.source_files,public.claims,public.conflicts,public.missing_info,public.questions,public.handovers,public.activity_events,public.graph_nodes,public.graph_edges TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- 9.1 Workspace
INSERT INTO public.workspaces (id, name, code, description, project_type, is_demo, created_by)
VALUES (
  'ws-apex',
  'Apex Autonomous Fleet OS',
  'APX-FLT',
  'Autonomous vehicle routing, telemetry ingestion, and cloud migration handover package.',
  'Engineering Continuity & Migration',
  true,
  NULL
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      code = EXCLUDED.code,
      description = EXCLUDED.description,
      project_type = EXCLUDED.project_type,
      is_demo = true,
      created_by = NULL;

-- 9.2 Sources (src-1..src-6 matching src/data/sampleData.ts)
INSERT INTO public.sources (
  id, workspace_id, title, type, filename, size_display, ingested_at_label, claims_count,
  status, extraction_status, reconstruct_status, author, repo_branch, summary, raw_excerpt, tags, is_user_uploaded
) VALUES
(
  'src-1', 'ws-apex', 'Apex Fleet Architecture Specification v2.4', 'pdf',
  'Apex_Architecture_Spec_v2.4.pdf', '4.8 MB', '2 days ago', 4,
  'ingested', 'success', 'completed', 'Elena Rostova (Principal Architect)', NULL,
  'Comprehensive blueprint detailing the microservices topography, Redis cluster configuration, and vehicle heartbeat protocols.',
  'Section 4.2 — Telemetry Ingestion Gateway: The ingestion layer operates over TLS 1.3 on TCP port 8443 with mandatory mTLS client verification. Every connected autonomous vehicle unit is provisioned with a 2048-bit RSA client certificate generated via the corporate Vault PKI engine.',
  ARRAY['Architecture', 'mTLS', 'Security', 'Ingestion'], false
),
(
  'src-2', 'ws-apex', 'Cloud Infrastructure & DB Migration Runbook', 'markdown',
  'cloud-infrastructure-runbook.md', '340 KB', '3 days ago', 3,
  'ingested', 'success', 'completed', 'Marcus Vance (Staff DevOps Engineer)', NULL,
  'Deployment specifications for AWS Aurora PostgreSQL 15.4 migration, PgBouncer pool sizing, and Graviton3 worker nodes.',
  'Database Modernization Plan: The persistent storage migration targets Aurora PostgreSQL 15.4 with the pgvector extension enabled. Fleet spatial coordinates are partitioned quarterly. Connection pooling is managed via PgBouncer with a pool ceiling of 400 worker connections.',
  ARRAY['Infrastructure', 'PostgreSQL', 'Kubernetes'], false
),
(
  'src-3', 'ws-apex', 'apex-fleet / telemetry-gateway (main branch)', 'github',
  'github.com/apex-fleet/telemetry-gateway', '12.4 MB repo', 'Yesterday', 2,
  'ingested', 'success', 'completed', 'Apex Core Platform Team', 'main @ 8b4c29e',
  'Core Golang telemetry service codebase, gRPC proto definitions, and Docker container build configs.',
  'heartbeat_service.go (L88-L104): const HeartbeatTimeoutThreshold = 12 * time.Second; const MaxMissedHeartbeats = 3; if vehicle.MissedHeartbeats >= MaxMissedHeartbeats { vehicle.SetState(VehicleStatusDegraded); eventBus.Publish("fleet.vehicle.degraded", vehicle.ID); }',
  ARRAY['GitHub', 'Go', 'gRPC', 'Telemetry'], false
),
(
  'src-4', 'ws-apex', 'Security Compliance Matrix & Identity Spec', 'pdf',
  'Security_Compliance_Matrix_2025.pdf', '2.1 MB', '5 days ago', 1,
  'needs_review', 'success', 'completed', 'InfoSec Compliance Office', NULL,
  'Identity provider mapping, SSO policies, and zero-trust perimeter definitions for fleet engineers.',
  'Identity Federation: Administrative consoles must authenticate against corporate Okta OIDC SSO with mandatory FIDO2/WebAuthn hardware key enforcement for all personnel holding cluster admin credentials.',
  ARRAY['Security', 'Okta', 'Identity', 'SSO'], false
),
(
  'src-5', 'ws-apex', 'Disaster Recovery Plan & SLA Requirements', 'markdown',
  'disaster-recovery-plan.md', '185 KB', '1 week ago', 2,
  'ingested', 'success', 'completed', 'Sara Chen (VP Engineering)', NULL,
  'Business continuity thresholds, multi-region replication targets, and emergency runbook steps.',
  'Recovery Objectives: Tier-1 fleet services must adhere to RPO < 5 minutes and RTO < 30 minutes. Cross-region replication between us-east-1 and us-west-2 runs continuously via AWS Global Aurora Storage.',
  ARRAY['Continuity', 'Disaster Recovery', 'SLA'], false
),
(
  'src-6', 'ws-apex', 'Sprint 44 Event Bus Architecture Decision Note', 'text',
  'sprint44-eventbus-decision.txt', '28 KB', '2 days ago', 1,
  'needs_review', 'success', 'completed', 'Devin Cole (Senior Backend Eng)', NULL,
  'Informal retrospective notes indicating an architectural pivot from Kafka to AWS Kinesis due to operational overhead.',
  'Sprint 44 Retrospective Note: Because self-managing the 5-node Apache Kafka cluster incurred excessive maintenance burdens, the team initiated a proof of concept moving telemetry streams to AWS Kinesis with 24-hour retention.',
  ARRAY['EventBus', 'Kafka', 'Kinesis', 'Conflict'], false
)
ON CONFLICT (id) DO NOTHING;

-- 9.3 Claims (CLM-101..CLM-112)
INSERT INTO public.claims (
  id, workspace_id, source_id, source_name, source_location, source_evidence_quote,
  statement, category, confidence_score, confidence_tier, verification_status,
  importance, evidence_grounded, last_reviewed_by, last_reviewed_at, human_review_notes, conflicting_evidence
) VALUES
(
  'CLM-101', 'ws-apex', 'src-1', 'Apex Fleet Architecture Specification v2.4',
  'Apex_Architecture_Spec_v2.4.pdf · Page 18, §4.2',
  'The ingestion layer operates over TLS 1.3 on TCP port 8443 with mandatory mTLS client verification. Every connected autonomous vehicle unit is provisioned with a 2048-bit RSA client certificate.',
  'The Telemetry Ingestion Gateway requires mTLS authentication with 2048-bit RSA client certificates on TCP port 8443.',
  'Security', 96, 'high', 'verified', 'critical', true,
  'Elena Rostova', 'Yesterday', 'Verified against current production Vault PKI rotation certificates.', NULL
),
(
  'CLM-102', 'ws-apex', 'src-2', 'Cloud Infrastructure & DB Migration Runbook',
  'cloud-infrastructure-runbook.md · Lines 45-58',
  'The persistent storage migration targets Aurora PostgreSQL 15.4 with the pgvector extension enabled. Fleet spatial coordinates are partitioned quarterly.',
  'Primary persistent database targets Aurora PostgreSQL 15.4 with the pgvector extension enabled for spatial fleet routing.',
  'Infrastructure', 92, 'high', 'verified', 'critical', true,
  'Marcus Vance', '2 days ago', NULL, NULL
),
(
  'CLM-103', 'ws-apex', 'src-1', 'Apex Fleet Architecture Specification v2.4',
  'Apex_Architecture_Spec_v2.4.pdf · Page 24, §5.1',
  'Telemetry messages are buffered across a 5-broker Apache Kafka 3.4 cluster distributed evenly across 3 AWS availability zones.',
  'Event streaming backbone is powered by a self-managed 5-broker Apache Kafka 3.4 cluster across 3 availability zones.',
  'Architecture', 68, 'moderate', 'conflicted', 'critical', true,
  NULL, NULL, 'High priority conflict. Architect must clarify whether Kinesis fully replaced Kafka or if Kafka remains for archival replay.',
  '{"claimId":"CLM-103-CONFLICT","sourceId":"src-6","sourceName":"Sprint 44 Event Bus Architecture Decision Note","sourceLocation":"sprint44-eventbus-decision.txt · Line 12","conflictingStatement":"Team initiated a migration away from Kafka to managed AWS Kinesis streams in Sprint 44 to reduce operational overhead.","conflictReason":"Direct contradiction on underlying message queue infrastructure (Kafka vs Kinesis). Unresolved before handover.","extractedDate":"2 days ago"}'::jsonb
),
(
  'CLM-104', 'ws-apex', 'src-3', 'apex-fleet / telemetry-gateway (main branch)',
  'heartbeat_service.go · Lines 88-92',
  'const HeartbeatTimeoutThreshold = 12 * time.Second; const MaxMissedHeartbeats = 3; if vehicle.MissedHeartbeats >= MaxMissedHeartbeats { vehicle.SetState(VehicleStatusDegraded); }',
  'Fleet heartbeat timeout threshold is 12 seconds; missing 3 consecutive heartbeats transitions vehicle to degraded status.',
  'Business Logic', 94, 'high', 'verified', 'high', true,
  'Elena Rostova', 'Yesterday', NULL, NULL
),
(
  'CLM-105', 'ws-apex', 'src-5', 'Disaster Recovery Plan & SLA Requirements',
  'disaster-recovery-plan.md · Section 2.1',
  'Tier-1 fleet services must adhere to RPO < 5 minutes and RTO < 30 minutes. Cross-region replication between us-east-1 and us-west-2 runs continuously.',
  'Tier-1 fleet services adhere to Recovery Point Objective (RPO) < 5 minutes and Recovery Time Objective (RTO) < 30 minutes.',
  'Infrastructure', 78, 'moderate', 'unverified', 'high', true,
  NULL, NULL, 'Pending disaster recovery tabletop rehearsal sign-off from VP Engineering.', NULL
),
(
  'CLM-106', 'ws-apex', 'src-4', 'Security Compliance Matrix & Identity Spec',
  'Security_Compliance_Matrix_2025.pdf · Page 8, §3.1',
  'Administrative consoles must authenticate against corporate Okta OIDC SSO with mandatory FIDO2/WebAuthn hardware key enforcement.',
  'Administrative portal authenticates via corporate Okta OIDC SSO with mandatory FIDO2 hardware token enforcement.',
  'Security', 61, 'moderate', 'conflicted', 'high', true,
  NULL, NULL, 'Needs confirmation from DevOps whether Auth0 was a temporary dev shim or the intended production direction.',
  '{"claimId":"CLM-106-CONFLICT","sourceId":"src-2","sourceName":"Cloud Infrastructure & DB Migration Runbook","sourceLocation":"cloud-infrastructure-runbook.md · Line 112","conflictingStatement":"Staging and dev environments are configured against Auth0 Universal Login rather than Okta.","conflictReason":"Discrepancy in IdP between corporate compliance specification (Okta) and active infrastructure deployment scripts (Auth0).","extractedDate":"3 days ago"}'::jsonb
),
(
  'CLM-107', 'ws-apex', 'src-2', 'Cloud Infrastructure & DB Migration Runbook',
  'cloud-infrastructure-runbook.md · Line 52',
  'Connection pooling is managed via PgBouncer with a pool ceiling of 400 worker connections.',
  'Database connection pooling utilizes PgBouncer with an enforced ceiling of 400 concurrent worker connections.',
  'Infrastructure', 84, 'high', 'unverified', 'standard', true,
  NULL, NULL, NULL, NULL
),
(
  'CLM-108', 'ws-apex', 'src-2', 'Cloud Infrastructure & DB Migration Runbook',
  'cloud-infrastructure-runbook.md · Line 88',
  'Production worker nodes execute on EKS v1.28 using c7g.2xlarge Graviton3 instances managed through Karpenter custom node pools.',
  'Worker node orchestration runs on Kubernetes 1.28 on AWS ARM64 Graviton3 instances using Karpenter auto-scaling.',
  'Infrastructure', 89, 'high', 'verified', 'high', true,
  'Marcus Vance', '3 days ago', NULL, NULL
),
(
  'CLM-109', 'ws-apex', 'src-5', 'Disaster Recovery Plan & SLA Requirements',
  'disaster-recovery-plan.md · Section 4.4',
  'Telemetry retention policy: S3 Standard tier for 90 days, followed by automated lifecycle transition to Glacier Deep Archive with a 7-year regulatory hold.',
  'Historical telemetry logs are retained for 90 days in warm S3 Standard and transitioned to Glacier Deep Archive for 7 years.',
  'Business Logic', 82, 'high', 'verified', 'standard', true,
  'Sara Chen', '4 days ago', NULL, NULL
),
(
  'CLM-110', 'ws-apex', 'src-3', 'apex-fleet / telemetry-gateway (main branch)',
  '.github/workflows/ci.yml · Line 34',
  'pytest --cov=gateway --cov-fail-under=85',
  'Automated CI pull request verification requires 85% branch test coverage before merge approval.',
  'Business Logic', 54, 'low', 'conflicted', 'standard', true,
  NULL, NULL, 'Minor inconsistency. Repo config (85%) should govern as active authoritative contract.',
  '{"claimId":"CLM-110-CONFLICT","sourceId":"src-1","sourceName":"Apex Fleet Architecture Specification v2.4","sourceLocation":"Apex_Architecture_Spec_v2.4.pdf · Page 39","conflictingStatement":"Specification stipulates 75% coverage requirement for non-routing utility services.","conflictReason":"Repository enforcement threshold (85%) is more stringent than architectural spec text (75%).","extractedDate":"Yesterday"}'::jsonb
),
(
  'CLM-111', 'ws-apex', 'src-1', 'Apex Fleet Architecture Specification v2.4',
  'Apex_Architecture_Spec_v2.4.pdf · Page 12, §2.3',
  'Edge dispatch workers are allocated warmed memory pools ensuring 99th percentile cold-start initialization remains beneath 250ms.',
  'Fleet dispatch edge worker nodes operate with a strict cold-start latency budget under 250 milliseconds.',
  'Architecture', 91, 'high', 'verified', 'critical', true,
  'Elena Rostova', 'Yesterday', NULL, NULL
),
(
  'CLM-112', 'ws-apex', 'src-1', 'Apex Fleet Architecture Specification v2.4',
  'Apex_Architecture_Spec_v2.4.pdf · Page 31, §6.4',
  'Vector map tiles are cached across Cloudflare Enterprise points of presence with edge routing to local micro-datacenters.',
  'Map vector tile delivery is cached via Cloudflare Enterprise with geo-distributed edge key-value storage.',
  'Dependencies', 88, 'high', 'unverified', 'standard', true,
  NULL, NULL, NULL, NULL
)
ON CONFLICT (id) DO NOTHING;

-- 9.4 Conflicts (CONF-1..CONF-2)
INSERT INTO public.conflicts (
  id, workspace_id, title, description, related_claim_ids, supporting_evidence, source_references, severity, status, is_ai_detected
) VALUES
(
  'CONF-1', 'ws-apex',
  'Event Bus Infrastructure Contradiction (Kafka vs Kinesis)',
  'Architecture specification mandates a 5-broker Apache Kafka 3.4 cluster across 3 availability zones, but Sprint 44 retrospective notes indicate an active migration pivot to AWS Kinesis streams.',
  ARRAY['CLM-103'],
  ARRAY[
    'Telemetry messages are buffered across a 5-broker Apache Kafka 3.4 cluster distributed evenly across 3 AWS availability zones.',
    'Team initiated a migration away from Kafka to managed AWS Kinesis streams in Sprint 44 to reduce operational overhead.'
  ],
  ARRAY[
    'Apex Fleet Architecture Specification v2.4 · Page 24, §5.1',
    'Sprint 44 Event Bus Architecture Decision Note · Line 12'
  ],
  'HIGH', 'open', false
),
(
  'CONF-2', 'ws-apex',
  'Identity Provider Discrepancy (Okta SSO vs Auth0)',
  'Security compliance matrix mandates corporate Okta OIDC SSO with FIDO2 hardware tokens for admin consoles, whereas database migration and deployment runbooks reference Auth0 Universal Login.',
  ARRAY['CLM-106'],
  ARRAY[
    'Administrative consoles must authenticate against corporate Okta OIDC SSO with mandatory FIDO2/WebAuthn hardware key enforcement.',
    'Staging and dev environments are configured against Auth0 Universal Login rather than Okta.'
  ],
  ARRAY[
    'Security Compliance Matrix & Identity Spec · Page 8, §3.1',
    'Cloud Infrastructure & DB Migration Runbook · Line 112'
  ],
  'MEDIUM', 'open', false
)
ON CONFLICT (id) DO NOTHING;

-- 9.5 Missing Info Findings (MISS-1..MISS-2)
INSERT INTO public.missing_info (
  id, workspace_id, category, title, description, why_it_matters, supporting_claim_ids, severity, status, action_suggestion
) VALUES
(
  'MISS-1', 'ws-apex', 'API Specifications',
  'External Partner REST/gRPC Rate Limiting & Throttling Specs',
  'While internal telemetry ingestion is documented via mTLS on port 8443, rate limits, quota tiers, and backpressure policies for third-party logistics partners are undocumented.',
  'Without documented API rate limits, incoming partner integrations risk denial of service or unhandled quota exhaustion errors during peak traffic surges.',
  ARRAY['CLM-101'], 'medium', 'open',
  'Author an API Gateway rate limiting contract specification for partner integrations.'
),
(
  'MISS-2', 'ws-apex', 'Testing Strategy',
  'Chaos Engineering & Automated Load Testing Procedures',
  'CI/CD pipeline test coverage is specified at 75%–85%, but live failure injection, regional failover testing (RTO/RPO), and load testing scripts are absent from source records.',
  'Ensures incoming team can validate whether RPO < 5 min and RTO < 30 min SLA targets hold under production simulated network partitions.',
  ARRAY['CLM-105', 'CLM-110'], 'high', 'open',
  'Document JMeter / Locust load testing suites and GameDay chaos testing runbooks.'
)
ON CONFLICT (id) DO NOTHING;

-- 9.6 Unresolved Questions (Q-1..Q-3)
INSERT INTO public.questions (
  id, workspace_id, question, context, related_claim_ids, status
) VALUES
(
  'Q-1', 'ws-apex',
  'Why was Apache Kafka selected initially if operational overhead prompted migration to AWS Kinesis in Sprint 44?',
  'Direct contradiction between architecture specification and Sprint 44 event bus decision note.',
  ARRAY['CLM-103'], 'open'
),
(
  'Q-2', 'ws-apex',
  'Are staging and development environments expected to transition from Auth0 to corporate Okta before formal handover?',
  'Discrepancy in identity provider between compliance matrix and deployment runbooks.',
  ARRAY['CLM-106'], 'open'
),
(
  'Q-3', 'ws-apex',
  'What is the exact post-mortem action item resulting from the Sprint 44 latency spike?',
  'Mentioned in retrospective notes regarding AWS Kinesis migration trigger.',
  '{}', 'open'
)
ON CONFLICT (id) DO NOTHING;

-- 9.7 Handover Dossier (draft pending signoff)
INSERT INTO public.handovers (
  id, workspace_id, title, version_label, target_audience, executive_note, final_comment, checklist, is_approved
) VALUES (
  'handover-ws-apex',
  'ws-apex',
  'Apex Autonomous Fleet OS — Handover Dossier',
  '1.0-RC (Pre-Transfer)',
  'Incoming Platform Core Engineering & SRE Teams',
  'This handover dossier consolidates verified architectural decisions, operational runbooks, infrastructure topology, and outstanding open questions for the Apex Autonomous Fleet OS prior to team transition.',
  '',
  '{"verified":false,"unverified":false,"conflicts":false,"missing":false,"evidence":false}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

-- 9.8 Activity Events (act-1..act-5)
INSERT INTO public.activity_events (
  id, workspace_id, type, timestamp_label, title, description, actor, actor_source, claim_id, source_id
) VALUES
(
  'act-1', 'ws-apex', 'claim_verified', '28 minutes ago',
  'Claim #CLM-101 Verified by Elena Rostova',
  'mTLS certificate specification confirmed against active HashiCorp Vault production PKI engine.',
  'Elena Rostova (Lead Architect)', 'system_seed', 'CLM-101', NULL
),
(
  'act-2', 'ws-apex', 'conflict_detected', '2 hours ago',
  'Architectural Conflict Detected: #CLM-103',
  'Direct contradiction between Architecture Spec v2.4 (Kafka) and Sprint 44 Decision Note (Kinesis).',
  'ProjectVault Confidence Engine', 'system_seed', 'CLM-103', NULL
),
(
  'act-3', 'ws-apex', 'source_ingested', 'Yesterday at 16:40',
  'Source Connected: apex-fleet/telemetry-gateway',
  'Ingested main branch repository tree (12.4 MB), extracting 11 structured claims and 4 gRPC proto definitions.',
  'Marcus Vance (DevOps)', 'system_seed', NULL, 'src-3'
),
(
  'act-4', 'ws-apex', 'claim_verified', 'Yesterday at 14:15',
  'Claim #CLM-104 Verified by Elena Rostova',
  'Heartbeat timeout threshold (12s / 3 missed) confirmed with telemetry gateway source code.',
  'Elena Rostova (Lead Architect)', 'system_seed', 'CLM-104', NULL
),
(
  'act-5', 'ws-apex', 'handover_drafted', '2 days ago',
  'Handover Package Draft v0.9 Initialized',
  'Created preliminary handover dossier structure with 4 core sections and verified grounded assertions.',
  'System Automation', 'system_seed', NULL, NULL
)
ON CONFLICT (id) DO NOTHING;

-- 9.9 Knowledge Graph Nodes & Edges (every FK verified against src-1..6 & CLM-101..112)
INSERT INTO public.graph_nodes (id, workspace_id, label, node_type, source_id, claim_id, metadata) VALUES
('node-src-1',      'ws-apex', 'Architecture Spec v2.4',       'source',    'src-1', NULL,      '{"docType":"pdf"}'::jsonb),
('node-src-2',      'ws-apex', 'Cloud Infra Runbook',          'source',    'src-2', NULL,      '{"docType":"markdown"}'::jsonb),
('node-src-3',      'ws-apex', 'telemetry-gateway (main)',     'source',    'src-3', NULL,      '{"docType":"github"}'::jsonb),
('node-src-6',      'ws-apex', 'Sprint 44 EventBus Note',      'source',    'src-6', NULL,      '{"docType":"text"}'::jsonb),
('node-clm-101',    'ws-apex', 'mTLS Port 8443 Contract',      'claim',     NULL,    'CLM-101', '{"status":"verified"}'::jsonb),
('node-clm-102',    'ws-apex', 'Aurora PG 15.4 + pgvector',    'claim',     NULL,    'CLM-102', '{"status":"verified"}'::jsonb),
('node-clm-103',    'ws-apex', 'Kafka 3.4 vs Kinesis Drift',   'risk',      NULL,    'CLM-103', '{"status":"conflicted"}'::jsonb),
('node-clm-104',    'ws-apex', '12s Heartbeat Degraded Rule',  'claim',     NULL,    'CLM-104', '{"status":"verified"}'::jsonb),
('node-svc-ingest', 'ws-apex', 'Telemetry Ingestion Gateway',  'service',   NULL,    NULL,      '{"port":8443}'::jsonb),
('node-svc-bus',    'ws-apex', 'Fleet Event Streaming Bus',    'component', NULL,    NULL,      '{"conflicted":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.graph_edges (id, workspace_id, from_node_id, to_node_id, relation_type, weight) VALUES
('edge-1', 'ws-apex', 'node-clm-101',    'node-src-1',      'extracted_from', 1.00),
('edge-2', 'ws-apex', 'node-clm-102',    'node-src-2',      'extracted_from', 1.00),
('edge-3', 'ws-apex', 'node-clm-103',    'node-src-1',      'extracted_from', 1.00),
('edge-4', 'ws-apex', 'node-clm-104',    'node-src-3',      'extracted_from', 1.00),
('edge-5', 'ws-apex', 'node-clm-101',    'node-svc-ingest', 'governs',        0.95),
('edge-6', 'ws-apex', 'node-clm-104',    'node-svc-ingest', 'governs',        0.90),
('edge-7', 'ws-apex', 'node-src-6',      'node-clm-103',    'contradicts',    0.98),
('edge-8', 'ws-apex', 'node-svc-ingest', 'node-svc-bus',    'depends_on',     0.92),
('edge-9', 'ws-apex', 'node-clm-103',    'node-svc-bus',    'governs',        0.85)
ON CONFLICT (id) DO NOTHING;

DELETE FROM private.operation_capabilities WHERE transaction_id=pg_catalog.pg_current_xact_id() AND operation='seed';
COMMIT;
