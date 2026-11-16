-- Add indexes for important composite foreign-key relationships.
-- These support referential actions and avoid unnecessary table scans.

CREATE INDEX IF NOT EXISTS idx_graph_nodes_ws_claim
  ON public.graph_nodes (workspace_id, claim_id);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_ws_source
  ON public.graph_nodes (workspace_id, source_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_invite
  ON public.workspace_members (workspace_id, joined_via_invite_id);
