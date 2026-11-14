import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import type { Express } from 'express';
import { createInviteRouter, hashInviteCode, normalizeInviteCode } from './supabaseInvite';

const USER_ID = '2d931510-d99f-494a-8c67-87feb05e1594';

async function withServer(handler: Express, run: (url: string) => Promise<void>) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('invite codes normalize and reject malformed values', () => {
  assert.equal(normalizeInviteCode(' pv-ab12-cd34 '), 'PV-AB12-CD34');
  assert.equal(normalizeInviteCode('PV-AB12-CD3!'), null);
  assert.equal(normalizeInviteCode(1234), null);
});

test('invite code hash is stable SHA-256 hex', () => {
  assert.equal(hashInviteCode('PV-AB12-CD34'), '02078f170fe5942c520e314f176e1406759f1cdc03801933a71da64e6b592ccb');
  assert.match(hashInviteCode('PV-AB12-CD34'), /^[0-9a-f]{64}$/);
});

test('redemption derives the user ID from Supabase Auth and sends the secret only as apikey', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    }
    return new Response(JSON.stringify([{
      workspace_id: 'ws-real',
      granted_role: 'editor',
      already_member: false,
    }]), { status: 200 });
  };

  const app = express();
  app.use(express.json());
  app.use(createInviteRouter({
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_test',
    secretKey: 'sb_secret_test',
    fetchImpl,
  }));

  await withServer(app, async (url) => {
    const response = await fetch(`${url}/api/workspaces/redeem-invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer user-session-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'pv-ab12-cd34', userId: 'attacker-controlled-id' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      workspaceId: 'ws-real',
      role: 'editor',
      alreadyMember: false,
    });
  });

  assert.equal(calls.length, 2);
  assert.equal(new Headers(calls[0].init?.headers).get('apikey'), 'sb_publishable_test');
  assert.equal(new Headers(calls[0].init?.headers).get('authorization'), 'Bearer user-session-token');
  assert.equal(new Headers(calls[1].init?.headers).get('apikey'), 'sb_secret_test');
  assert.equal(new Headers(calls[1].init?.headers).has('authorization'), false);
  const rpcBody = JSON.parse(String(calls[1].init?.body));
  assert.equal(rpcBody.p_user_id, USER_ID);
  assert.equal(rpcBody.p_code_hash, hashInviteCode('PV-AB12-CD34'));
  assert.notEqual(rpcBody.p_user_id, 'attacker-controlled-id');
});

test('redemption rejects requests without a bearer session before calling Supabase', async () => {
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use(createInviteRouter({
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_test',
    secretKey: 'sb_secret_test',
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    },
  }));

  await withServer(app, async (url) => {
    const response = await fetch(`${url}/api/workspaces/redeem-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'PV-AB12-CD34' }),
    });
    assert.equal(response.status, 401);
  });
  assert.equal(calls, 0);
});
