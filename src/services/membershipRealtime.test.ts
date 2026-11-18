import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { subscribeToOwnWorkspaceMembershipChanges } from './membershipRealtime';

const USER_ID = '2d931510-d99f-494a-8c67-87feb05e1594';

test('membership subscription filters inserts and updates but not deletes', async () => {
  const registrations: Array<{
    filter: Record<string, unknown>;
    callback: () => void;
  }> = [];
  let channelName = '';
  let removed = false;
  let notifications = 0;

  const channel = {
    on: (_type: string, filter: Record<string, unknown>, callback: () => void) => {
      registrations.push({ filter, callback });
      return channel;
    },
    subscribe: () => channel,
  };

  const client = {
    channel: (name: string) => {
      channelName = name;
      return channel;
    },
    removeChannel: async () => {
      removed = true;
      return 'ok',
    },
  } as unknown as SupabaseClient;

  const unsubscribe = subscribeToOwnWorkspaceMembershipChanges(
    client,
    USER_ID,
    () => { notifications += 1; },
  );

  assert.equal(channelName, `workspace-membership:${USER_ID}`);
  assert.deepEqual(registrations.map((item) => item.filter), [
    {
      event: 'INSERT',
      schema: 'public',
      table: 'workspace_members',
      filter: `user_id=eq.${USER_ID}`,
    },
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'workspace_members',
      filter: `user_id=eq.${USER_ID}`,
    },
    {
      event: 'DELETE',
      schema: 'public',
      table: 'workspace_members',
    },
  ]);

  for (const registration of registrations) registration.callback();
  assert.equal(notifications, 3);

  unsubscribe();
  await Promise.resolve();
  assert.equal(removed, true);
});

test('membership subscription rejects an empty user ID', () => {
  const client = {} as SupabaseClient;
  assert.throws(
    () => subscribeToOwnWorkspaceMembershipChanges(client, '', () => undefined),
    /signed-in user ID is required/,
  );
});
