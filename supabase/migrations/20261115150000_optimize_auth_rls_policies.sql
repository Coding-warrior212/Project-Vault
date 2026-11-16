-- Optimize auth.uid() evaluation in RLS policies.
-- Preserve all existing authorization rules and policy behavior.

-- Profiles: SELECT
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_authenticated_non_demo()
    AND (
      id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm_self
        JOIN public.workspace_members wm_target
          ON wm_target.workspace_id = wm_self.workspace_id
        WHERE wm_self.user_id = (SELECT auth.uid())
          AND wm_target.user_id = profiles.id
          AND NOT public.is_demo_workspace(wm_self.workspace_id)
      )
    )
  );

-- Profiles: INSERT
DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
CREATE POLICY profiles_insert_policy ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_authenticated_non_demo()
    AND id = (SELECT auth.uid())
  );

-- Profiles: UPDATE
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_authenticated_non_demo()
    AND id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_authenticated_non_demo()
    AND id = (SELECT auth.uid())
  );

-- Workspace members: UPDATE
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
        AND user_id <> (SELECT auth.uid())
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
        AND user_id <> (SELECT auth.uid())
      )
    )
  );

-- Workspace members: DELETE
DROP POLICY IF EXISTS workspace_members_delete_policy ON public.workspace_members;
CREATE POLICY workspace_members_delete_policy ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    NOT public.is_demo_workspace(workspace_id)
    AND (
      user_id = (SELECT auth.uid())
      OR public.has_workspace_role(workspace_id, ARRAY['owner'])
      OR (
        public.has_workspace_role(workspace_id, ARRAY['admin'])
        AND role NOT IN ('owner', 'admin')
      )
    )
  );

-- Activity events: INSERT
DROP POLICY IF EXISTS activity_events_insert_policy ON public.activity_events;
CREATE POLICY activity_events_insert_policy ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_demo_workspace(workspace_id)
    AND public.has_workspace_role(
      workspace_id,
      ARRAY['owner', 'admin', 'editor', 'reviewer']
    )
    AND actor_user_id = (SELECT auth.uid())
    AND actor_source = 'jwt'
  );
