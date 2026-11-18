import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Keep workspace membership state current without exposing other members'
 * deletion metadata to every connected workspace user.
 *
 * INSERT/UPDATE use a row filter for the signed-in user. A private Broadcast
 * topic receives a database-triggered revocation signal addressed only to
 * that user. The payload is treated only as an invalidation signal; access
 * is always re-queried through the user's JWT and RLS.
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

  const membershipChannel = client.channel(`workspace-membership:${userId}`);

  membershipChannel
    .on('postgres_changes', {
      event: 'INSERT',
      ...ownMembershipFilter,
    }, onMembershipChange)
    .on('postgres_changes', {
      event: 'UPDATE',
      ...ownMembershipFilter,
    }, onMembershipChange)
    .subscribe();

  const revocationChannel = client
    .channel(`pv-membership-revoked:${userId}`, { config: { private: true } })
    .on('broadcast', { event: 'membership_revoked' }, onMembershipChange)
    .subscribe();

  return () => {
    void client.removeChannel(membershipChannel);
    void client.removeChannel(revocationChannel);
  };
}
