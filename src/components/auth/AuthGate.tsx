import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, CheckCircle2, Chrome, KeyRound, LockKeyhole, LogOut, Mail, ShieldCheck, Users } from 'lucide-react';
import { KnowledgeNetwork3D, Vault3DLogo } from '../common/Soft3DVisuals';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { WorkspaceSessionProvider } from './WorkspaceSessionContext';
import { resetLocalDemoData, setLocalStorageScope } from '../../services/db';
import { subscribeToOwnWorkspaceMembershipChanges } from '../../services/membershipRealtime';

type WorkspaceAccess = {
  id: string;
  name: string;
  code: string;
  description: string;
  projectType: string;
  role: string;
};

type AuthMode = 'sign_in' | 'sign_up';

const fieldClass = 'pv-auth-field';
const buttonClass = 'pv-auth-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed';

export const AuthGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [mode, setMode] = React.useState<AuthMode>('sign_in');
  const [isPasswordRecovery, setIsPasswordRecovery] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [workspaces, setWorkspaces] = React.useState<WorkspaceAccess[]>([]);
  const [activeWorkspace, setActiveWorkspace] = React.useState<WorkspaceAccess | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState('');
  const [inviteBusy, setInviteBusy] = React.useState(false);
  const [createWorkspaceBusy, setCreateWorkspaceBusy] = React.useState(false);
  const [workspaceName, setWorkspaceName] = React.useState('');
  const [workspaceDescription, setWorkspaceDescription] = React.useState('');
  const [demoMode, setDemoMode] = React.useState(false);
  const [demoResetBusy, setDemoResetBusy] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
        setSession(nextSession);
        if (!nextSession) { setActiveWorkspace(null); setWorkspaces([]); }
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
      setActiveWorkspace(null);
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
        setActiveWorkspace(null);
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
      setActiveWorkspace((current) => current && !allowed.some((workspace) => workspace.id === current.id) ? null : current);
    } catch (loadError) {
      console.error('[ProjectVault Auth] Workspace access lookup failed:', loadError);
      // Fail closed in the UI: do not leave a previously selected workspace
      // mounted when membership verification can no longer be completed.
      setWorkspaces([]);
      setActiveWorkspace(null);
      setError('Workspace access could not be verified. Your private workspaces are hidden until access can be confirmed.');
    } finally {
      setWorkspaceLoading(false);
    }
  }, [session?.user?.id]);

  React.useEffect(() => {
    if (session) void loadWorkspaceAccess();
    else {
      setWorkspaces([]);
      setActiveWorkspace(null);
    }
  }, [session, loadWorkspaceAccess]);

  React.useEffect(() => {
    if (!supabase || !session?.user?.id) return;

    // Membership changes trigger a fresh server-authorized lookup. INSERT/UPDATE
    // are filtered to this user; revocation uses a private user-specific Broadcast.
    // Every notification is only an invalidation signal, never authorization proof.
    return subscribeToOwnWorkspaceMembershipChanges(
      supabase,
      session.user.id,
      () => { void loadWorkspaceAccess(); },
    );
  }, [session?.user?.id, loadWorkspaceAccess]);

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
    setMessage('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError) {
      console.error('[ProjectVault Auth] Google sign-in failed:', oauthError);
      setError(oauthError instanceof Error
        ? oauthError.message
        : 'Google sign-in could not be started. Please try again.');
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

  const handleCreateWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !session || workspaceName.trim().length < 2) return;
    setCreateWorkspaceBusy(true);
    setError('');
    setMessage('');
    try {
      // Workspace ownership is assigned atomically by the database from auth.uid().
      // The browser never supplies an owner/user ID and never uses a service key.
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const random = new Uint8Array(8);
      crypto.getRandomValues(random);
      const code = 'PV-' + Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
      const { error: createError } = await supabase.rpc('create_workspace_atomic', {
        p_name: workspaceName.trim(),
        p_code: code,
        p_description: workspaceDescription.trim(),
        p_project_type: 'Engineering Continuity',
        p_owner_id: null,
      });
      if (createError) throw createError;
      setWorkspaceName('');
      setWorkspaceDescription('');
      setMessage('Workspace created. Your owner membership is being verified from the database.');
      await loadWorkspaceAccess();
    } catch (createError) {
      console.error('[ProjectVault Auth] Workspace creation failed:', createError);
      setError(createError instanceof Error ? createError.message : 'Workspace creation failed. Please try again.');
    } finally {
      setCreateWorkspaceBusy(false);
    }
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

  const handleSetNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || password.length < 8) return;
    setBusy(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message);
    else {
      setPassword('');
      setIsPasswordRecovery(false);
      setMessage('Your password has been updated.');
    }
  };

  const handleResetDemo = async () => {
    const confirmed = window.confirm('Reset the local ProjectVault demo in this browser? This clears local demo records only. Authenticated team workspaces are not affected.');
    if (!confirmed) return;
    setDemoResetBusy(true);
    try {
      await resetLocalDemoData();
      setDemoMode(false);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'The local demo could not be reset.');
    } finally {
      setDemoResetBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else setActiveWorkspace(null);
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

  if (demoMode) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div role="status" className="sticky top-0 z-50 flex flex-col gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-center sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-xs font-semibold text-amber-950"><span className="font-black tracking-wider">INTERACTIVE JUDGE DEMO</span><span className="mx-2 hidden sm:inline">·</span><span className="block font-normal sm:inline">This is a local demo session. Changes stay in this browser and never sync to team workspaces.</span></div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <button type="button" onClick={() => void handleResetDemo()} disabled={demoResetBusy} className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50">{demoResetBusy ? "Resetting…" : "Reset demo"}</button>
            <button type="button" onClick={() => { setLocalStorageScope('default'); setDemoMode(false); }} className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100">Exit demo</button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  if (authLoading) {
    return <AuthShell><div className="py-12 text-center text-sm text-slate-600">Restoring your secure session…</div></AuthShell>;
  }

  if (!session) {
    return (
      <AuthShell wide>
        <div className="grid items-stretch gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
          <aside className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-[#45447E] bg-[#25245F] p-6 text-[#FFF4E3] shadow-[4px_4px_0px_#F36B3F] sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full border border-[#55C7C2]/20" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <Vault3DLogo size="lg" />
                <div>
                  <p className="text-lg font-extrabold tracking-tight">ProjectVault</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">Knowledge continuity system</p>
                </div>
              </div>
              <div className="mt-12">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#55C7C2]">Knowledge that stays. Projects that move.</p>
                <h1 className="mt-4 max-w-md text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
                  Keep critical project knowledge in motion.
                </h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-[#FFF4E3]/70">
                  A shared workspace for verified sources, connected decisions, unresolved questions, and dependable handovers.
                </p>
              </div>
            </div>
            <div className="relative mt-8">
              <KnowledgeNetwork3D className="mx-auto" />
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-[9px] tracking-wide text-white/70">01 / SOURCE</span>
                <span className="rounded-md border border-[#55C7C2]/40 bg-[#55C7C2]/10 px-2.5 py-1.5 font-mono text-[9px] tracking-wide text-[#9CE6E1]">02 / VERIFY</span>
                <span className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-[9px] tracking-wide text-white/70">03 / HANDOVER</span>
              </div>
            </div>
          </aside>

          <section className="flex flex-col justify-center py-1">
            <div className="mb-7">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#258D89] dark:text-[#55C7C2]">
                {mode === 'sign_up' ? 'Create your identity' : 'Secure workspace access'}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#25245F] dark:text-[#FFF4E3] sm:text-3xl">
                {mode === 'sign_up' ? 'Start building continuity.' : 'Welcome back.'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#65647E] dark:text-[#C1BED8]">
                {mode === 'sign_up'
                  ? 'Create an account to establish your identity and access your team workspace.'
                  : 'Sign in to verify your identity and access your team’s workspaces.'}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl border border-[#25245F]/10 bg-[#F1EBDD] p-1 dark:border-white/10 dark:bg-[#15143C]">
              <button type="button" onClick={() => { setMode('sign_in'); setError(''); setMessage(''); }} className={mode === 'sign_in' ? 'rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-[#25245F] shadow-sm dark:bg-[#302F68] dark:text-[#FFF4E3]' : 'rounded-lg px-3 py-2.5 text-sm font-semibold text-[#65647E] transition hover:text-[#25245F] dark:text-[#B9B6D1] dark:hover:text-white'}>Sign in</button>
              <button type="button" onClick={() => { setMode('sign_up'); setError(''); setMessage(''); }} className={mode === 'sign_up' ? 'rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-[#25245F] shadow-sm dark:bg-[#302F68] dark:text-[#FFF4E3]' : 'rounded-lg px-3 py-2.5 text-sm font-semibold text-[#65647E] transition hover:text-[#25245F] dark:text-[#B9B6D1] dark:hover:text-white'}>Create account</button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {mode === 'sign_up' && (
                <label className="block">
                  <span className="pv-auth-label mb-1.5 block text-xs font-bold">Full name</span>
                  <input className="pv-auth-field" autoComplete="name" placeholder="Your full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </label>
              )}
              <label className="block">
                <span className="pv-auth-label mb-1.5 block text-xs font-bold">Email address</span>
                <input className="pv-auth-field" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="block">
                <span className="pv-auth-label mb-1.5 block text-xs font-bold">Password</span>
                <input className="pv-auth-field" type="password" autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'} minLength={8} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <button className="pv-auth-primary flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold disabled:cursor-not-allowed" disabled={busy} type="submit">
                {busy ? 'Please wait…' : mode === 'sign_up' ? 'Create your account' : 'Sign in securely'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {mode === 'sign_in' && <button type="button" disabled={busy} onClick={handlePasswordReset} className="mt-3 w-full text-center text-xs font-bold text-[#258D89] transition hover:text-[#25245F] disabled:opacity-50 dark:text-[#55C7C2] dark:hover:text-white">Forgot password?</button>}

            <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-[#85849B] dark:text-[#9693B4]">
              <span className="h-px flex-1 bg-[#25245F]/15 dark:bg-white/15" />or continue with<span className="h-px flex-1 bg-[#25245F]/15 dark:bg-white/15" />
            </div>
            <button type="button" onClick={handleGoogleSignIn} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25245F]/20 bg-white px-4 py-3 text-sm font-bold text-[#25245F] transition hover:border-[#55C7C2] hover:bg-[#FFFCF6] disabled:opacity-50 dark:border-white/15 dark:bg-[#15143C] dark:text-[#FFF4E3] dark:hover:bg-[#222154]">
              <Chrome className="h-4 w-4" /> Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-[#85849B] dark:text-[#9693B4]">
              <span className="h-px flex-1 bg-[#25245F]/15 dark:bg-white/15" />or explore first<span className="h-px flex-1 bg-[#25245F]/15 dark:bg-white/15" />
            </div>
            <button type="button" onClick={() => { setLocalStorageScope('judge-demo'); setDemoMode(true); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#55C7C2]/60 bg-[#55C7C2]/15 px-4 py-3 text-sm font-bold text-[#174F50] transition hover:bg-[#55C7C2]/25 dark:text-[#A7E8E3]">
              Explore interactive demo <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-5 text-center text-[10px] leading-5 text-[#65647E] dark:text-[#B9B6D1]">
              Workspace access is enforced by Supabase Row Level Security—not by client-side filtering alone.
            </p>
            <AuthFeedback error={error} message={message} />
          </section>
        </div>
      </AuthShell>
    );
  }

  if (session && isPasswordRecovery) {
    return (
      <AuthShell>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-950 text-white"><LockKeyhole className="h-6 w-6" /></div>
          <h1 className="text-2xl font-bold text-slate-950">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-600">Set a new password for {session.user.email}.</p>
        </div>
        <form onSubmit={handleSetNewPassword} className="space-y-3">
          <input className={fieldClass} type="password" minLength={8} autoComplete="new-password" placeholder="New password (at least 8 characters)" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button className={buttonClass + ' w-full'} type="submit" disabled={busy || password.length < 8}>{busy ? 'Updating…' : 'Update password'}</button>
        </form>
        <AuthFeedback error={error} message={message} />
      </AuthShell>
    );
  }

  if (activeWorkspace && workspaces.some((workspace) => workspace.id === activeWorkspace.id)) {
    return (
      <WorkspaceSessionProvider value={{
        session,
        workspace: activeWorkspace,
        selectWorkspace: setActiveWorkspace,
        switchWorkspace: () => setActiveWorkspace(null),
      }}>
        <div className="pv-auth-page min-h-screen">
          <div className="flex items-center justify-between gap-3 border-b border-[#25245F]/15 bg-white/90 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#1B1A48]/95 sm:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[#25245F] dark:text-[#FFF4E3]">{activeWorkspace.name}</p>
              <p className="text-[11px] text-[#65647E] dark:text-[#C1BED8]">{activeWorkspace.role} · {session.user.email}</p>
            </div>
            <button type="button" onClick={() => setActiveWorkspace(null)} className="shrink-0 rounded-lg border border-[#25245F]/20 px-3 py-2 text-xs font-bold text-[#25245F] transition hover:border-[#55C7C2] hover:bg-[#55C7C2]/10 dark:border-white/20 dark:text-[#FFF4E3] dark:hover:bg-white/5">Switch workspace</button>
          </div>
          {children}
        </div>
      </WorkspaceSessionProvider>
    );
  }

  return (
    <AuthShell wide>
      <div className="flex flex-col gap-4 border-b border-[#25245F]/10 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#258D89] dark:text-[#55C7C2]">Authenticated session</p>
          <h1 className="mt-1 text-2xl font-bold text-[#25245F] dark:text-[#FFF4E3]">Your workspace access</h1>
          <p className="mt-1 text-sm text-[#65647E] dark:text-[#C1BED8]">{session.user.email}</p>
        </div>
        <button type="button" onClick={handleSignOut} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#25245F]/30 dark:border-white/20 px-3 py-2 text-xs font-semibold text-[#383765] dark:text-[#E7E3F4] transition-all duration-150 ease-out hover:-translate-y-1 hover:border-[#F36B3F] hover:shadow-[4px_4px_0px_0px_#F36B3F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"><LogOut className="h-4 w-4" /> Sign out</button>
      </div>

      <div className="pv-auth-panel pv-auth-accent mt-6 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#174F50] dark:text-[#A7E8E3]" />
          <div><p className="text-sm font-semibold text-[#174F50] dark:text-[#A7E8E3]">Identity verified by Supabase Auth</p><p className="mt-1 text-xs leading-5 text-[#245F60] dark:text-[#A7E8E3]">The list below is loaded through the signed-in user's JWT and workspace RLS policies. Only memberships returned by the database are displayed.</p></div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#25245F] dark:text-[#FFF4E3]"><Users className="h-4 w-4" /> Workspaces you can access</h2>
          <button type="button" onClick={() => void loadWorkspaceAccess()} disabled={workspaceLoading} className="text-xs font-semibold text-[#258D89] dark:text-[#55C7C2] disabled:opacity-50">{workspaceLoading ? 'Refreshing…' : 'Refresh access'}</button>
        </div>
        {workspaceLoading ? <p className="pv-auth-panel p-5 text-sm text-[#85849B] dark:text-[#B9B6D1]">Checking workspace memberships…</p> :
          workspaces.length === 0 ? <p className="pv-auth-panel border-dashed p-5 text-sm text-[#65647E] dark:text-[#C1BED8]">No team workspace memberships were found for this account yet. Redeem an invitation below to join a workspace.</p> :
          <div className="grid gap-3 sm:grid-cols-2">{workspaces.map((workspace) => <button type="button" key={workspace.id} onClick={() => setActiveWorkspace(workspace)} className="pv-workspace-card rounded-xl p-4 text-left focus:outline-none focus:ring-2 focus:ring-[#55C7C2] focus:ring-offset-2 dark:focus:ring-offset-[#1B1A48]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#25245F] dark:text-[#FFF4E3]">{workspace.name}</p><p className="mt-1 font-mono text-[11px] text-[#85849B] dark:text-[#B9B6D1]">{workspace.code}</p></div><span className="rounded-full bg-[#25245F]/[0.06] dark:bg-white/[0.045] px-2.5 py-1 text-[10px] font-bold uppercase text-[#25245F] dark:text-[#FFF4E3]">{workspace.role}</span></div><p className="mt-3 text-xs leading-5 text-[#65647E] dark:text-[#C1BED8]">{workspace.description || workspace.projectType}</p><p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#174F50] dark:text-[#A7E8E3]"><CheckCircle2 className="h-3.5 w-3.5" /> Membership verified · Open workspace <ArrowRight className="ml-auto h-4 w-4" /></p></button>)}</div>
        }
      </div>

      <form onSubmit={handleCreateWorkspace} className="pv-auth-panel mt-6 p-4 sm:p-5">
        <label className="mb-2 block text-sm font-bold text-[#25245F] dark:text-[#FFF4E3]" htmlFor="projectvault-workspace-name">Create a team workspace</label>
        <div className="grid gap-2">
          <input id="projectvault-workspace-name" className={fieldClass} placeholder="e.g. Project Atlas" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} minLength={2} maxLength={120} required />
          <textarea className={fieldClass} placeholder="Short description (optional)" value={workspaceDescription} onChange={(event) => setWorkspaceDescription(event.target.value)} maxLength={500} rows={2} />
          <button className="pv-auth-primary w-full px-4 py-3 text-sm font-bold sm:w-auto" type="submit" disabled={createWorkspaceBusy || workspaceName.trim().length < 2}>{createWorkspaceBusy ? 'Creating securely…' : 'Create workspace'}</button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#65647E] dark:text-[#C1BED8]">The database creates the workspace and assigns its owner in one transaction using your verified Supabase identity. No browser-supplied user ID or privileged key is used.</p>
      </form>

      <form onSubmit={handleInviteRedeem} className="pv-auth-panel mt-6 p-4 sm:p-5">
        <label className="mb-2 block text-sm font-bold text-[#25245F] dark:text-[#FFF4E3]" htmlFor="projectvault-invite">Join with an invitation code</label>
        <div className="flex flex-col gap-2 sm:flex-row"><input id="projectvault-invite" className={fieldClass} placeholder="PV-XXXX-XXXX" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={16} required /><button className="pv-auth-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-3 text-sm font-bold" type="submit" disabled={inviteBusy || !inviteCode.trim()}><KeyRound className="h-4 w-4" /> {inviteBusy ? 'Verifying…' : 'Redeem invite'}</button></div>
        <p className="mt-2 text-[11px] text-[#85849B] dark:text-[#B9B6D1]">The server validates your Supabase session and redeems the invite atomically. User IDs are never accepted from the browser.</p>
      </form>

      <button type="button" onClick={() => { setLocalStorageScope('judge-demo'); setDemoMode(true); }} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#55C7C2]/60 bg-[#55C7C2]/15 px-4 py-3 text-sm font-bold text-[#174F50] transition hover:bg-[#55C7C2]/25 dark:text-[#A7E8E3]">Explore interactive demo <ArrowRight className="h-4 w-4" /></button>
      <div className="pv-auth-panel mt-6 p-4 text-xs leading-5 text-[#25245F] dark:text-[#FFF4E3]">
        <strong>Select a workspace to continue.</strong> Project records are loaded only after you open an authorized workspace. Local demo records are never copied into team workspaces automatically.
      </div>
      <AuthFeedback error={error} message={message} />
    </AuthShell>
  );
};

const AuthShell: React.FC<React.PropsWithChildren<{ wide?: boolean }>> = ({ children, wide = false }) => (
  <main className="pv-auth-page flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
    <section className={`pv-auth-card w-full rounded-2xl p-5 sm:p-8 ${wide ? 'max-w-6xl' : 'max-w-md'}`}>
      {children}
    </section>
  </main>
);

const AuthFeedback: React.FC<{ error: string; message: string }> = ({ error, message }) => (
  <>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
  </>
);
