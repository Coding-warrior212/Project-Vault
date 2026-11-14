import { createHash } from 'node:crypto';
import express, { type Request, type Response } from 'express';

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
  windowMs?: number;
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
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const attempts = new Map<string, AttemptWindow>();

  router.post('/api/workspaces/redeem-invite', express.json({ limit: '2kb' }), async (req: Request, res: Response) => {
    const now = Date.now();
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
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
