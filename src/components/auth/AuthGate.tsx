import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, CheckCircle2, Github, KeyRound, LockKeyhole, LogOut, Mail, ShieldCheck, Users } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type WorkspaceAccess = {
  id: string;
  name: string;
  code: string;
  description: string;
  projectType: string;
  role: string;
};

type AuthMode = 'sign_in' | 'sign_up';

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50';

export const AuthGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [mode, setMode] = React.useState<AuthMode>('sign_in');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [workspaces, setWorkspaces] = React.useState<WorkspaceAccess[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState('');
  const [inviteBusy, setInviteBusy] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setError('');
        setMessage('');
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError('Could not restore your sign-in session. Please sign in again.');
      setSession(data.session);
    }).catch(() => {
      if (active) setError('Could not restore your sign-in session. Please sign in again.');
    }).finally(() => {
      if (active) setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadWorkspaceAccess = React.useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      setWorkspaces([]);
      return;
    }

    setWorkspaceLoading(true);
    setError('');
    try {
      // This query is scoped to the signed-in user. RLS independently enforces
      // membership, so a modified client cannot broaden workspace visibility.
      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', session.user.id);

      if (membershipError) throw membershipError;
      const rows = memberships ?? [];
      if (rows.length === 0) {
        setWorkspaces([]);
        return;
      }

      const roleByWorkspace = new Map(rows.map((row) => [row.workspace_id, row.role]));
      const workspaceIds = [...roleByWorkspace.keys()];
      const { data: workspaceRows, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, name, code, description, project_type')
        .in('id', workspaceIds)
        .eq('is_demo', false);

      if (workspaceError) throw workspaceError;
      const allowed = (workspaceRows ?? []).map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        code: workspace.code,
        description: workspace.description ?? '',
        projectType: workspace.project_type ?? 'Engineering Continuity',
        role: roleByWorkspace.get(workspace.id) ?? 'viewer',
      }));
      setWorkspaces(allowed);
    } catch (loadError) {
      console.error('[ProjectVault Auth] Workspace access lookup failed:', loadError);
      setWorkspaces([]);
      setError('Workspace access could not be verified. Your private workspaces are hidden until access can be confirmed.');
    } finally {
      setWorkspaceLoading(false);
    }
  }, [session?.user?.id]);

  React.useEffect(() => {
    if (session) void loadWorkspaceAccess();
    else setWorkspaces([]);
  }, [session, loadWorkspaceAccess]);

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'sign_up') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) throw signUpError;
        setMessage('Account request received. Check your email to confirm your address, then sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!supabase || !email.trim()) {
      setError('Enter your email address first so we can send a password reset link.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (resetError) setError(resetError.message);
    else setMessage('If an account exists for that email, a password reset link has been sent.');
  };

  const handleInviteRedeem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !inviteCode.trim()) return;
    setInviteBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/workspaces/redeem-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const result = await response.json() as { error?: string; workspaceId?: string; role?: string; alreadyMember?: boolean };
      if (!response.ok) throw new Error(result.error || 'Invite redemption failed.');
      setInviteCode('');
      setMessage(result.alreadyMember
        ? 'You already have access to this workspace.'
        : `Invite accepted. Your workspace role is ${result.role ?? 'member'}.`);
      await loadWorkspaceAccess();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Invite redemption failed.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    setBusy(false);
  };

  if (!isSupabaseConfigured || !supabase) {
    return (
      <>
        <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
          <LockKeyhole className="h-4 w-4" />
          Local demo mode · Supabase Auth is not configured in this deployment
        </div>
        {children}
      </>
    );
  }

  if (authLoading) {
    return <AuthShell><div className="py-12 text-center text-sm text-slate-600">Restoring your secure session…</div></AuthShell>;
  }

  if (!session) {
    return (
      <AuthShell>
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950 text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-600">Knowledge that stays. Projects that move.</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Welcome to ProjectVault</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to verify your identity and access your team's workspaces.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => { setMode('sign_in'); setError(''); setMessage(''); }} className={mode === 'sign_in' ? 'rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-950 shadow-sm' : 'px-3 py-2 text-sm font-medium text-slate-500'}>Sign in</button>
          <button type="button" onClick={() => { setMode('sign_up'); setError(''); setMessage(''); }} className={mode === 'sign_up' ? 'rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-950 shadow-sm' : 'px-3 py-2 text-sm font-medium text-slate-500'}>Create account</button>
        </div>

        <form onSubmit={handleAuth} className="space-y-3">
          {mode === 'sign_up' && <input className={fieldClass} autoComplete="name" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</span>
            <input className={fieldClass} type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Password</span>
            <input className={fieldClass} type="password" autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'} minLength={8} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className={buttonClass + ' w-full'} disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'sign_up' ? 'Create account' : 'Sign in securely'} <ArrowRight className="h-4 w-4" /></button>
        </form>

        {mode === 'sign_in' && <button type="button" disabled={busy} onClick={handlePasswordReset} className="mt-3 w-full text-center text-xs font-semibold text-indigo-700 hover:text-indigo-950">Forgot password?</button>}
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or continue with<span className="h-px flex-1 bg-slate-200" /></div>
        <button type="button" onClick={handleGoogleSignIn} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"><Github className="h-4 w-4" /> Continue with Google</button>
        <p className="mt-4 text-center text-[11px] text-slate-500">Your workspace access is enforced by Supabase Row Level Security, not by client-side filtering alone.</p>
        <AuthFeedback error={error} message={message} />
      </AuthShell>
    );
  }

  return (
    <AuthShell wide>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Authenticated session</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Your workspace access</h1>
          <p className="mt-1 text-sm text-slate-600">{session.user.email}</p>
        </div>
        <button type="button" onClick={handleSignOut} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" /> Sign out</button>
      </div>

      <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div><p className="text-sm font-semibold text-teal-950">Identity verified by Supabase Auth</p><p className="mt-1 text-xs leading-5 text-teal-900">The list below is loaded through the signed-in user's JWT and workspace RLS policies. Only memberships returned by the database are displayed.</p></div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Users className="h-4 w-4" /> Workspaces you can access</h2>
          <button type="button" onClick={() => void loadWorkspaceAccess()} disabled={workspaceLoading} className="text-xs font-semibold text-indigo-700 disabled:opacity-50">{workspaceLoading ? 'Refreshing…' : 'Refresh access'}</button>
        </div>
        {workspaceLoading ? <p className="rounded-xl border border-slate-200 p-5 text-sm text-slate-500">Checking workspace memberships…</p> :
          workspaces.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No team workspace memberships were found for this account yet. Redeem an invitation below to join a workspace.</p> :
          <div className="grid gap-3 sm:grid-cols-2">{workspaces.map((workspace) => <div key={workspace.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{workspace.name}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{workspace.code}</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase text-indigo-800">{workspace.role}</span></div><p className="mt-3 text-xs leading-5 text-slate-600">{workspace.description || workspace.projectType}</p><p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-teal-700"><CheckCircle2 className="h-3.5 w-3.5" /> Membership verified</p></div>)}</div>
        }
      </div>

      <form onSubmit={handleInviteRedeem} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="mb-2 block text-sm font-bold text-slate-900" htmlFor="projectvault-invite">Join with an invitation code</label>
        <div className="flex flex-col gap-2 sm:flex-row"><input id="projectvault-invite" className={fieldClass} placeholder="PV-XXXX-XXXX" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={16} required /><button className={buttonClass + ' shrink-0'} type="submit" disabled={inviteBusy || !inviteCode.trim()}><KeyRound className="h-4 w-4" /> {inviteBusy ? 'Verifying…' : 'Redeem invite'}</button></div>
        <p className="mt-2 text-[11px] text-slate-500">The server validates your Supabase session and redeems the invite atomically. User IDs are never accepted from the browser.</p>
      </form>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
        <strong>Workspace data connection is the next milestone.</strong> Your membership and role are verified, but the existing project screens still use local demo data. Private workspace records are intentionally not displayed until the cloud persistence adapter is connected and tested.
      </div>
      <AuthFeedback error={error} message={message} />
    </AuthShell>
  );
};

const AuthShell: React.FC<React.PropsWithChildren<{ wide?: boolean }>> = ({ children, wide = false }) => (
  <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
    <section className={`w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9 ${wide ? 'max-w-4xl' : 'max-w-md'}`}>
      {children}
    </section>
  </main>
);

const AuthFeedback: React.FC<{ error: string; message: string }> = ({ error, message }) => (
  <>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{message}</p>}
  </>
);
