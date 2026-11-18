import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Subscribe to changes affecting the signed-in user's workspace memberships.
 *
 * INSERT and UPDATE events can be filtered by user_id. DELETE events cannot
 * reliably be filtered by user_id on an RLS-protected table: Realtime only
 * exposes the old primary key by default, and DELETE events are not evaluated
 * against row policies. The unfiltered DELETE handler therefore acts only as
 * an invalidation signal. It ignores the payload and asks the caller to
 * re-query the current user's memberships through RLS.
 */
export function subscribeToOwnWorkspaceMembershipChanges(
  client: SupabaseClient,
  userId: string,
  onMembershipChange: () => void,
): () => void {
  if (!userId) throw new Error('A signed-in user ID is required.');

  const ownMembershipFilter = {
    schema: 'public',
    table: 'workspace_members',
    filter: `user_id=eq.${userId}`,
  } as const;

  const channel = client.channel(`workspace-membership:${userId}`);

  channel
    .on('postgres_changes', {
      event: 'INSERT',
      ...ownMembershipFilter,
    }, onMembershipChange)
    .on('postgres_changes', {
      event: 'UPDATE',
      ...ownMembershipFilter,
    }, onMembershipChange)
    .on('postgres_changes', {
      // Do not add a user_id filter here. The old row is not available for
      // reliable filtering under RLS, so this callback revalidates access
      // after any membership deletion without reading the event payload.
      event: 'DELETE',
      schema: 'public',
      table: 'workspace_members',
    }, onMembershipChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
