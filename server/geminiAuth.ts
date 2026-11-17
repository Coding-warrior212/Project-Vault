import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type WorkspaceRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'reviewer'
  | 'viewer';

export type WorkspaceAuthorization =
  | {
      ok: true;
      db: SupabaseClient;
      userId: string;
      role: WorkspaceRole;
      workspaceId: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Accept only a structurally valid, explicitly non-anonymous Supabase user. */
export function isVerifiedWorkspaceUser(
  user: { id?: unknown; is_anonymous?: unknown } | null | undefined,
): user is { id: string; is_anonymous: false } {
  return Boolean(
    user &&
    typeof user.id === 'string' &&
    UUID_PATTERN.test(user.id) &&
    user.is_anonymous === false
  );
}

export async function authorizeGeminiWorkspace(
  authorizationHeader: string | undefined,
  workspaceIdValue: unknown,
  allowedRoles: readonly WorkspaceRole[],
): Promise<WorkspaceAuthorization> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return {
      ok: false,
      status: 503,
      error: 'Workspace authorization is not configured on this server.',
    };
  }

  if (
    typeof workspaceIdValue !== 'string' ||
    workspaceIdValue.trim().length === 0 ||
    workspaceIdValue.length > 128
  ) {
    return {
      ok: false,
      status: 400,
      error: 'A valid workspace ID is required.',
    };
  }

  const bearerMatch = /^Bearer\s+([^\s]+)$/i.exec(authorizationHeader ?? '');
  if (!bearerMatch || bearerMatch[1].length > 8192) {
    return {
      ok: false,
      status: 401,
      error: 'A valid sign-in session is required.',
    };
  }

  const token = bearerMatch[1];
  const db = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  try {
    // Validate the token with Supabase Auth. Never trust decoded JWT claims.
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token);

    if (authError || !user || !UUID_PATTERN.test(user.id)) {
      return {
        ok: false,
        status: 401,
        error: 'Your sign-in session is invalid or expired. Please sign in again.',
      };
    }

    if (!isVerifiedWorkspaceUser(user)) {
      return {
        ok: false,
        status: 403,
        error: 'An authenticated team account is required.',
      };
    }

    // This query runs with the user's JWT, so workspace_members RLS applies.
    const { data: membership, error: membershipError } = await db
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceIdValue)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) {
      console.error('[Gemini authorization] Membership lookup failed:', membershipError.code);
      return {
        ok: false,
        status: 503,
        error: 'Workspace permissions could not be verified. Please try again.',
      };
    }

    const role = membership?.role as WorkspaceRole | undefined;

    if (!role || !['owner', 'admin', 'editor', 'reviewer', 'viewer'].includes(role)) {
      return {
        ok: false,
        status: 403,
        error: 'You are not a member of this workspace.',
      };
    }

    if (!allowedRoles.includes(role)) {
      return {
        ok: false,
        status: 403,
        error: 'Your workspace role does not have permission to perform this AI operation.',
      };
    }

    return {
      ok: true,
      db,
      userId: user.id,
      role,
      workspaceId: workspaceIdValue,
    };
  } catch (error) {
    console.error(
      '[Gemini authorization] Verification request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return {
      ok: false,
      status: 503,
      error: 'Workspace authorization is temporarily unavailable.',
    };
  }
}
