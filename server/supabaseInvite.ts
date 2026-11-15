import { createHash, randomBytes } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { isIP } from 'node:net';

type FetchLike = typeof fetch;

export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^PV-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized) ? normalized : null;
}

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

interface InviteRouterOptions {
  supabaseUrl?: string;
  publishableKey?: string;
  secretKey?: string;
  fetchImpl?: FetchLike;
  maxAttempts?: number;
  maxCreateAttempts?: number;
  windowMs?: number;
  trustCloudflareIpHeader?: boolean;
}

interface AttemptWindow {
  count: number;
  resetAt: number;
}

export function createInviteRouter(options: InviteRouterOptions = {}) {
  const router = express.Router();
  const supabaseUrl = (options.supabaseUrl ?? process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const publishableKey = options.publishableKey ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
  const secretKey = options.secretKey ?? process.env.SUPABASE_SECRET_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxAttempts = options.maxAttempts ?? 8;
  const maxCreateAttempts = options.maxCreateAttempts ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const trustCloudflareIpHeader = options.trustCloudflareIpHeader ??
    process.env.PROJECTVAULT_TRUST_CF_CONNECTING_IP === 'true';
  const attempts = new Map<string, AttemptWindow>();
  const createAttempts = new Map<string, AttemptWindow>();

  function consumeAttempt(
    store: Map<string, AttemptWindow>,
    key: string,
    limit: number,
  ): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    }

    entry.count += 1;

    if (store.size > 5000) {
      for (const [storedKey, value] of store) {
        if (value.resetAt <= now) store.delete(storedKey);
      }
      while (store.size > 5000) {
        const oldestKey = store.keys().next().value;
        if (oldestKey === undefined) break;
        store.delete(oldestKey);
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }


  router.post('/api/workspaces/create-invite', express.json({ limit: '2kb' }), async (req: Request, res: Response) => {
    if (!supabaseUrl || !publishableKey) {
      return res.status(503).json({ error: 'Workspace invitations are not configured on this server.' });
    }

    const authorization = req.header('authorization') ?? '';
    const bearerMatch = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!bearerMatch || bearerMatch[1].length > 8192) {
      return res.status(401).json({ error: 'A valid sign-in session is required.' });
    }

    const workspaceId = req.body?.workspaceId;
    const grantedRole = req.body?.role ?? 'editor';
    const maxUses = req.body?.maxUses ?? 1;
    const expiresInDays = req.body?.expiresInDays ?? 7;

    if (typeof workspaceId !== 'string' || !workspaceId.trim() || workspaceId.length > 128) {
      return res.status(400).json({ error: 'A valid workspace is required.' });
    }
    if (!['admin', 'editor', 'reviewer', 'viewer'].includes(grantedRole)) {
      return res.status(400).json({ error: 'Choose a valid invitation role.' });
    }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
      return res.status(400).json({ error: 'Invitation use limit must be between 1 and 100.' });
    }
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
      return res.status(400).json({ error: 'Invitation expiry must be between 1 and 30 days.' });
    }

    try {
      // Validate the real Supabase session. The database remains responsible
      // for checking workspace membership and owner/admin permissions via RLS.
      const authResponse = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${bearerMatch[1]}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

      if (!authResponse.ok) {
        return res.status(401).json({ error: 'Your sign-in session is invalid or expired. Please sign in again.' });
      }

      const authUser = await authResponse.json() as { id?: unknown; is_anonymous?: unknown };
      if (
        typeof authUser.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUser.id) ||
        authUser.is_anonymous !== false
      ) {
        return res.status(403).json({ error: 'Only a signed-in workspace member can create an invitation.' });
      }

      const createLimit = consumeAttempt(createAttempts, authUser.id, maxCreateAttempts);
      if (!createLimit.allowed) {
        res.setHeader('Retry-After', String(createLimit.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many invitations created. Please try again later.' });
      }

      // 32-character alphabet: each random byte maps evenly to one character.
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes = randomBytes(8);
      const code = `PV-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(0, 4).join('')}-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(4, 8).join('')}`;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      // Insert with the user's own bearer token and publishable key.
      // Never use the server secret for invitation creation: RLS and the
      // lifecycle trigger must enforce owner/admin permissions and created_by.
      const insertResponse = await fetchImpl(`${supabaseUrl}/rest/v1/workspace_invites`, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${bearerMatch[1]}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          workspace_id: workspaceId.trim(),
          code_hash: hashInviteCode(code),
          code_prefix: code.slice(0, 7),
          granted_role: grantedRole,
          max_uses: maxUses,
          expires_at: expiresAt,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

      if (!insertResponse.ok) {
        const body = (await insertResponse.text()).toLowerCase();
        if (insertResponse.status === 401 || insertResponse.status === 403 ||
            body.includes('insufficient_role') || body.includes('row-level security') ||
            body.includes('admin_protection')) {
          return res.status(403).json({ error: 'Only an authorized workspace owner or admin can create this invitation. Admins cannot invite other admins.' });
        }
        console.error('[Invite creation] Supabase insert failed:', insertResponse.status);
        return res.status(502).json({ error: 'The invitation could not be saved. Please try again.' });
      }

      // The plaintext code is returned once. Only its hash is stored.
      return res.status(201).json({
        code,
        role: grantedRole,
        maxUses,
        expiresAt,
      });
    } catch (error) {
      console.error('[Invite creation] Request failed:', error);
      return res.status(502).json({ error: 'Invitation creation is temporarily unavailable.' });
    }
  });

  router.post('/api/workspaces/redeem-invite', express.json({ limit: '2kb' }), async (req: Request, res: Response) => {
    const now = Date.now();
    const cloudflareIp = trustCloudflareIpHeader ? req.get('cf-connecting-ip') : undefined;
    const clientKey = cloudflareIp && isIP(cloudflareIp) !== 0
      ? cloudflareIp
      : req.socket.remoteAddress || 'unknown';
    let window = attempts.get(clientKey);

    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs };
      attempts.set(clientKey, window);
    }
    window.count += 1;

    // Bound the in-memory limiter so unique IPs cannot grow it indefinitely.
    if (attempts.size > 5000) {
      for (const [key, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(key);
      }
      while (attempts.size > 5000) {
        const oldestKey = attempts.keys().next().value;
        if (oldestKey === undefined) break;
        attempts.delete(oldestKey);
      }
    }

    if (window.count > maxAttempts) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((window.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Too many invite attempts. Please try again later.' });
    }

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return res.status(503).json({ error: 'Workspace invitations are not configured on this server.' });
    }

    const authorization = req.header('authorization') ?? '';
    const bearerMatch = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!bearerMatch || bearerMatch[1].length > 8192) {
      return res.status(401).json({ error: 'A valid sign-in session is required.' });
    }

    const code = normalizeInviteCode(req.body?.code);
    if (!code) {
      return res.status(400).json({ error: 'Enter an invite code in the format PV-XXXX-XXXX.' });
    }

    try {
      // Ask Supabase Auth to validate the access token. Never decode an unverified JWT
      // or accept a user ID from the request body.
      const authResponse = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${bearerMatch[1]}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

      if (!authResponse.ok) {
        return res.status(401).json({ error: 'Your sign-in session is invalid or expired. Please sign in again.' });
      }

      const authUser = await authResponse.json() as { id?: unknown; is_anonymous?: unknown };
      if (
        typeof authUser.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUser.id) ||
        authUser.is_anonymous !== false
      ) {
        return res.status(403).json({ error: 'Only a signed-in team member can redeem a workspace invite.' });
      }

      // The secret key is sent only as an apikey header (never as a bearer JWT).
      const rpcResponse = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/redeem_workspace_invite_by_hash_atomic`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          p_user_id: authUser.id,
          p_code_hash: hashInviteCode(code),
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

      if (!rpcResponse.ok) {
        const body = await rpcResponse.text();
        const message = body.toLowerCase();
        if (message.includes('invite_not_found')) {
          return res.status(404).json({ error: 'That invite code is not valid.' });
        }
        if (message.includes('invite_expired')) {
          return res.status(410).json({ error: 'That invite code has expired.' });
        }
        if (message.includes('invite_revoked')) {
          return res.status(410).json({ error: 'That invite code has been revoked.' });
        }
        if (message.includes('invite_exhausted')) {
          return res.status(410).json({ error: 'That invite code has reached its use limit.' });
        }
        if (message.includes('demo_workspace_immutable') || message.includes('owner_protection')) {
          return res.status(403).json({ error: 'This invite cannot be used.' });
        }
        console.error('[Invite redemption] Supabase RPC failed:', rpcResponse.status);
        return res.status(502).json({ error: 'Invite redemption could not be completed. Please try again.' });
      }

      const result = await rpcResponse.json() as Array<{
        workspace_id?: unknown;
        granted_role?: unknown;
        already_member?: unknown;
      }>;
      const redeemed = Array.isArray(result) ? result[0] : undefined;
      if (
        !redeemed ||
        typeof redeemed.workspace_id !== 'string' ||
        typeof redeemed.granted_role !== 'string' ||
        typeof redeemed.already_member !== 'boolean'
      ) {
        console.error('[Invite redemption] Supabase RPC returned an unexpected response shape.');
        return res.status(502).json({ error: 'Invite redemption returned an unexpected response.' });
      }

      return res.status(200).json({
        workspaceId: redeemed.workspace_id,
        role: redeemed.granted_role,
        alreadyMember: redeemed.already_member,
      });
    } catch (error) {
      console.error('[Invite redemption] Request failed:', error);
      return res.status(502).json({ error: 'Invite redemption is temporarily unavailable.' });
    }
  });

  return router;
}
