-- ProjectVault's Judge Demo is browser-local; anonymous Supabase table access
-- is not required. Remove the broad anon SELECT grants and anon policy roles.
-- This also avoids permission errors when anon policies invoke helpers that
-- intentionally require authenticated EXECUTE. Authenticated workspace access
-- continues to be governed by RLS.
BEGIN;

REVOKE SELECT ON TABLE
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.workspace_invites,
  public.sources,
  public.source_files,
  public.claims,
  public.conflicts,
  public.missing_info,
  public.questions,
  public.handovers,
  public.activity_events,
  public.graph_nodes,
  public.graph_edges
FROM anon;

ALTER POLICY workspaces_select_policy ON public.workspaces TO authenticated;
ALTER POLICY activity_events_select_policy ON public.activity_events TO authenticated;
ALTER POLICY sources_select_policy ON public.sources TO authenticated;
ALTER POLICY claims_select_policy ON public.claims TO authenticated;
ALTER POLICY conflicts_select_policy ON public.conflicts TO authenticated;
ALTER POLICY missing_info_select_policy ON public.missing_info TO authenticated;
ALTER POLICY questions_select_policy ON public.questions TO authenticated;
ALTER POLICY handovers_select_policy ON public.handovers TO authenticated;
ALTER POLICY graph_nodes_select_policy ON public.graph_nodes TO authenticated;
ALTER POLICY graph_edges_select_policy ON public.graph_edges TO authenticated;

COMMIT;
