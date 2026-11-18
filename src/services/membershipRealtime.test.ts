import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { subscribeToOwnWorkspaceMembershipChanges } from './membershipRealtime';

const USER_ID = '2d931510-d99f-494a-8c67-87feb05e1594';

test('membership changes use user filters and a private user-specific revocation channel', async () => {
  const registrations: Array<{
    topic: string;
    config?: Record<string, unknown>;
    type: string;
    filter: Record<string, unknown>;
    callback: () => void;
  }> = [];
  const removedTopics: string[] = [];
  let notifications = 0;

  const client = {
    channel: (topic: string, config?: Record<string, unknown>) => {
      const channel = {
        topic,
        on: (type: string, filter: Record<string, unknown>, callback: () => void) => {
          registrations.push({ topic, config, type, filter, callback });
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: async (channel: { topic: string }) => {
      removedTopics.push(channel.topic);
      return 'ok',
    },
  } as unknown as SupabaseClient;

  const unsubscribe = subscribeToOwnWorkspaceMembershipChanges(
    client,
    USER_ID,
    () => { notifications += 1; },
  );

  assert.deepEqual(registrations.map((item) => ({
    topic: item.topic,
    type: item.type,
    filter: item.filter,
    private: item.config?.private,
  })), [
    {
      topic: `workspace-membership:${USER_ID}`,
      type: 'postgres_changes',
      filter: {
        event: 'INSERT',
        schema: 'public',
        table: 'workspace_members',
        filter: `user_id=eq.${USER_ID}`,
      },
      private: undefined,
    },
    {
      topic: `workspace-membership:${USER_ID}`,
      type: 'postgres_changes',
      filter: {
        event: 'UPDATE',
        schema: 'public',
        table: 'workspace_members',
        filter: `user_id=eq.${USER_ID}`,
      },
      private: undefined,
    },
    {
      topic: `pv-membership-revoked:${USER_ID}`,
      type: 'broadcast',
      filter: { event: 'membership_revoked' },
      private: true,
    },
  ]);

  for (const registration of registrations) registration.callback();
  assert.equal(notifications, 3);

  unsubscribe();
  await Promise.resolve();
  assert.deepEqual(removedTopics.sort(), [
    `pv-membership-revoked:${USER_ID}`,
    `workspace-membership:${USER_ID}`,
  ]);
});

test('membership subscription rejects an empty user ID', () => {
  const client = {} as SupabaseClient;
  assert.throws(
    () => subscribeToOwnWorkspaceMembershipChanges(client, '', () => undefined),
    /signed-in user ID is required/,
  );
});
