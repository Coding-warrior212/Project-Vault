import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { Workspace } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  Settings,
  Cpu,
  Database,
  Github,
  Sliders,
  ShieldCheck,
  RefreshCw,
  Info,
  Check,
  Layers,
  Sparkles,
  UserPlus,
  Copy,
  CheckCheck,
} from 'lucide-react';

interface SettingsPageProps {
  currentWorkspace: Workspace;
  onResetSampleData: () => void;
  session: Session | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentWorkspace,
  onResetSampleData,
  session,
}) => {
  const [threshold, setThreshold] = React.useState(75);
  const [conflictSensitivity, setConflictSensitivity] = React.useState<'strict' | 'standard'>('strict');
  const [autoDeduplicate, setAutoDeduplicate] = React.useState(true);
  const [isSaved, setIsSaved] = React.useState(false);
  const [inviteRole, setInviteRole] = React.useState<'admin' | 'editor' | 'reviewer' | 'viewer'>('editor');
  const [inviteMaxUses, setInviteMaxUses] = React.useState(1);
  const [inviteExpiry, setInviteExpiry] = React.useState(7);
  const [inviteCode, setInviteCode] = React.useState('');
  const [inviteBusy, setInviteBusy] = React.useState(false);
  const [inviteError, setInviteError] = React.useState('');
  const [inviteCopied, setInviteCopied] = React.useState(false);

  type WorkspaceMember = {
    id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';
    full_name: string;
    email: string;
  };

  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const [membersError, setMembersError] = React.useState('');
  const [memberActionError, setMemberActionError] = React.useState('');
  const [changingMemberId, setChangingMemberId] = React.useState('');
  const [memberRefreshKey, setMemberRefreshKey] = React.useState(0);

  const isWorkspaceOwner = currentWorkspace.role.toLowerCase() === 'owner';
  const canManageInvites = isWorkspaceOwner || currentWorkspace.role.toLowerCase() === 'admin';

  React.useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      if (!isWorkspaceOwner || !supabase) {
        setMembers([]);
        return;
      }

      setMembersLoading(true);
      setMembersError('');

      try {
        const { data: membershipRows, error: membershipError } = await supabase
          .from('workspace_members')
          .select('id, user_id, role')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: true });

        if (membershipError) throw membershipError;

        const rows = membershipRows ?? [];
        const userIds = rows.map((member) => member.user_id);

        const { data: profiles, error: profilesError } = userIds.length
          ? await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds)
          : { data: [], error: null };

        if (profilesError) throw profilesError;

        if (!cancelled) {
          const profileById = new Map(
            (profiles ?? []).map((profile) => [profile.id, profile])
          );

          setMembers(rows.map((member) => {
            const profile = profileById.get(member.user_id);
            return {
              id: member.id,
              user_id: member.user_id,
              role: member.role,
              full_name: profile?.full_name ?? '',
              email: profile?.email ?? '',
            } as WorkspaceMember;
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setMembersError(
            error instanceof Error ? error.message : 'Could not load workspace members.'
          );
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace.id, isWorkspaceOwner, memberRefreshKey]);

  const handleMemberRoleChange = async (
    member: WorkspaceMember,
    newRole: WorkspaceMember['role']
  ) => {
    if (!isWorkspaceOwner || !supabase || !session?.access_token) {
      setMemberActionError('An authenticated workspace owner session is required.');
      return;
    }

    if (member.role === 'owner' || member.user_id === session.user.id) {
      setMemberActionError('The workspace owner cannot change their own role or another owner’s role here.');
      return;
    }

    if (member.role === newRole) return;

    setChangingMemberId(member.id);
    setMemberActionError('');

    try {
      const { error } = await supabase.rpc('change_workspace_member_role_atomic', {
        p_workspace_id: currentWorkspace.id,
        p_target_user_id: member.user_id,
        p_new_role: newRole,
      });

      if (error) throw error;

      setMembers((current) =>
        current.map((item) =>
          item.id === member.id ? { ...item, role: newRole } : item
        )
      );
      setMemberRefreshKey((value) => value + 1);
    } catch (error) {
      setMemberActionError(
        error instanceof Error ? error.message : 'The member role could not be updated.'
      );
      setMemberRefreshKey((value) => value + 1);
    } finally {
      setChangingMemberId('');
    }
  };

  const handleCreateInvite = async () => {
    if (!session?.access_token || !canManageInvites) {
      setInviteError('A signed-in workspace owner or admin session is required.');
      return;
    }

    setInviteBusy(true);
    setInviteError('');
    setInviteCode('');
    setInviteCopied(false);

    try {
      const response = await fetch('/api/workspaces/create-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          role: inviteRole,
          maxUses: inviteMaxUses,
          expiresInDays: inviteExpiry,
        }),
      });

      const result = await response.json() as { code?: string; error?: string };

      if (!response.ok || typeof result.code !== 'string') {
        throw new Error(result.error || 'Could not create the invitation.');
      }

      setInviteCode(result.code);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Invitation creation failed.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
    } catch {
      setInviteError('Clipboard access failed. Select and copy the invitation code manually.');
    }
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-6 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#25245F] dark:text-[#55C7C2]">
                Settings & Integration Architecture
              </span>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-[#FFF4E3] mt-1">
              Workspace Configuration & Engine Parameters
            </h2>
            <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] mt-0.5">
              Configure extraction confidence rules, workspace metadata, and future integration endpoints.
            </p>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white dark:text-[#111033] bg-[#25245F] dark:bg-[#55C7C2] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] rounded-lg border-2 border-[#25245F] dark:border-[#55C7C2] shadow-[3px_3px_0px_#55C7C2] dark:shadow-[3px_3px_0px_#25245F] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            {isSaved ? <Check className="w-3.5 h-3.5 text-[#55C7C2] dark:text-[#111033]" /> : null}
            <span>{isSaved ? 'Saved Settings' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Workspace Profile Card */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <Layers className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
          Active Workspace Metadata
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-neutral-500 dark:text-[#8E8DAF] font-semibold mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              defaultValue={currentWorkspace.name}
              className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] font-medium focus:outline-none focus:ring-1 focus:ring-[#25245F] dark:focus:ring-[#55C7C2]"
            />
          </div>

          <div>
            <label className="block text-neutral-500 dark:text-[#8E8DAF] font-semibold mb-1">
              Project Identifier Code
            </label>
            <input
              type="text"
              defaultValue={currentWorkspace.code}
              className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#25245F] dark:focus:ring-[#55C7C2]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-neutral-500 dark:text-[#8E8DAF] font-semibold mb-1">
              Workspace Description & Scope
            </label>
            <textarea
              defaultValue={currentWorkspace.description}
              rows={2}
              className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] focus:outline-none focus:ring-1 focus:ring-[#25245F] dark:focus:ring-[#55C7C2]"
            />
          </div>
        </div>
      </div>

      {/* Workspace Invitations */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <UserPlus className="w-3.5 h-3.5 text-[#55C7C2]" />
          Workspace Invitations
        </h3>

        {!canManageInvites ? (
          <p className="text-xs text-neutral-600 dark:text-[#C4C3E0]">
            Only workspace owners and admins can create invitations. Your current role is {currentWorkspace.role}.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-neutral-600 dark:text-[#C4C3E0]">
              Generate a secure, single-display invitation code for another signed-in user to join
              <span className="font-semibold"> {currentWorkspace.name}</span>.
              The code is shown only once; only its hash is stored.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="space-y-1">
                <span className="block font-semibold text-neutral-700 dark:text-[#C4C3E0]">Member role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3]"
                >
                  {isWorkspaceOwner && <option value="admin">Admin</option>}
                  <option value="editor">Editor</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="block font-semibold text-neutral-700 dark:text-[#C4C3E0]">Expires after</span>
                <select
                  value={inviteExpiry}
                  onChange={(e) => setInviteExpiry(Number(e.target.value))}
                  className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3]"
                >
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="block font-semibold text-neutral-700 dark:text-[#C4C3E0]">Maximum uses</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleCreateInvite}
              disabled={inviteBusy || !session?.access_token}
              className="px-4 py-2 text-xs font-bold text-white dark:text-[#111033] bg-[#25245F] dark:bg-[#55C7C2] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] disabled:opacity-50 rounded-lg border-2 border-[#25245F] dark:border-[#55C7C2] shadow-[3px_3px_0px_#55C7C2] dark:shadow-[3px_3px_0px_#25245F] transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {inviteBusy ? 'Generating invitation…' : 'Generate Invitation Code'}
            </button>

            {inviteError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">{inviteError}</p>
            )}

            {inviteCode && (
              <div className="p-4 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-[#55C7C2]/60 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-[#C4C3E0]">
                  Your invitation code — copy it now
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <code className="text-lg sm:text-xl font-bold tracking-widest text-[#25245F] dark:text-[#55C7C2]">
                    {inviteCode}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="px-3 py-2 text-xs font-bold rounded-lg border border-neutral-300 dark:border-[#35337C] text-neutral-800 dark:text-[#FFF4E3] hover:bg-white dark:hover:bg-[#25245F] flex items-center gap-1.5 cursor-pointer"
                  >
                    {inviteCopied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {inviteCopied ? 'Copied' : 'Copy code'}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-[#8E8DAF]">
                  Share this code with the person joining. It will not be displayed again after you leave or refresh this page.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workspace Member Management — Owner Only */}
      {isWorkspaceOwner && (
        <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between gap-3 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#55C7C2]" />
              Workspace Members & Permissions
            </h3>
            <button
              type="button"
              onClick={() => setMemberRefreshKey((value) => value + 1)}
              disabled={membersLoading}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-neutral-300 dark:border-[#35337C] text-neutral-700 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F] disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${membersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <p className="text-xs text-neutral-600 dark:text-[#C4C3E0]">
            Review workspace membership and manage roles. Only the workspace owner can change member permissions.
            Ownership itself can only be changed through the dedicated ownership-transfer operation.
          </p>

          {membersLoading && (
            <div className="text-xs text-neutral-500 dark:text-[#8E8DAF] py-3">
              Loading workspace members…
            </div>
          )}

          {membersError && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {membersError}
            </div>
          )}

          {memberActionError && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {memberActionError}
            </div>
          )}

          {!membersLoading && !membersError && members.length === 0 && (
            <div className="text-xs text-neutral-500 dark:text-[#8E8DAF] py-3">
              No workspace members were found.
            </div>
          )}

          <div className="space-y-2">
            {members.map((member) => {
              const isSelf = member.user_id === session?.user.id;
              const displayName = member.full_name.trim() || member.email || 'Workspace member';
              const isChanging = changingMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border border-neutral-200 dark:border-[#2D2C68]"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-neutral-900 dark:text-[#FFF4E3] truncate">
                      {displayName}
                      {isSelf && (
                        <span className="ml-2 text-[10px] font-semibold text-[#168B85] dark:text-[#55C7C2]">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] truncate mt-0.5">
                      {member.email || member.user_id}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isChanging && (
                      <span className="text-[10px] text-neutral-500 dark:text-[#8E8DAF]">
                        Saving…
                      </span>
                    )}
                    <select
                      aria-label={`Role for ${displayName}`}
                      value={member.role}
                      disabled={isSelf || member.role === 'owner' || isChanging || changingMemberId !== ''}
                      onChange={(event) =>
                        void handleMemberRoleChange(
                          member,
                          event.target.value as WorkspaceMember['role']
                        )
                      }
                      className="min-w-28 p-2 text-xs font-semibold bg-white dark:bg-[#1B1A48] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="owner" disabled>Owner</option>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-neutral-500 dark:text-[#8E8DAF]">
            Every successful role change is recorded in the workspace activity log. Members may need to refresh their session to load their updated permissions.
          </p>
        </div>
      )}

      {/* Extraction & Confidence Engine Settings */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <Cpu className="w-3.5 h-3.5 text-[#F36B3F]" />
          Knowledge Confidence & Conflict Engine Rules
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">
                Minimum Verification Confidence Threshold
              </span>
              <span className="font-mono font-bold text-[#25245F] dark:text-[#55C7C2]">{threshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[#25245F] dark:accent-[#55C7C2]"
            />
            <p className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] mt-1">
              Claims with confidence scores below this threshold will automatically be queued for human verification in the Review tab.
            </p>
          </div>

          <div className="pt-3 border-t-2 border-neutral-100 dark:border-[#2D2C68] flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">
                Conflict Detection Strictness
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-[#8E8DAF]">
                Flag subtle numerical and version differences as explicit discrepancies.
              </div>
            </div>
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#14133B] p-1 rounded-lg border border-neutral-300 dark:border-[#2D2C68]">
              <button
                onClick={() => setConflictSensitivity('strict')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  conflictSensitivity === 'strict'
                    ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] font-bold shadow-xs'
                    : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Strict (Recommended)
              </button>
              <button
                onClick={() => setConflictSensitivity('standard')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  conflictSensitivity === 'standard'
                    ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] font-bold shadow-xs'
                    : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Standard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Next Stage Integration Roadmap */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <Database className="w-3.5 h-3.5 text-[#55C7C2]" />
          Backend & AI Integration Readiness
        </h3>

        <div className="space-y-3">
          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F36B3F]" />
                Gemini API Knowledge Synthesizer
              </div>
              <div className="text-neutral-500 dark:text-[#8E8DAF] text-[11px]">
                Gemini-powered extraction and conflict analysis are available through authenticated server routes with workspace-scoped authorization and retry handling.
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
              Authenticated · Available
            </span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#55C7C2]" />
                PostgreSQL & Supabase Persistence
              </div>
              <div className="text-neutral-500 dark:text-[#8E8DAF] text-[11px]">
                Supabase Auth, workspace-scoped PostgreSQL persistence, and Storage are connected. Workspace live updates have been verified across two sessions, including reconnect and membership-scoped private DELETE notifications.
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
              Connected · Live updates verified
            </span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
                GitHub REST API & Webhooks
              </div>
              <div className="text-neutral-500 dark:text-[#8E8DAF] text-[11px]">
                Manual synchronization is available for public GitHub repositories. Private-repository OAuth, webhooks, and background sync are not connected. Change-impact views currently use derived source-to-claim evidence links.
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/40 px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700">
              Public repo sync available
            </span>
          </div>
        </div>
      </div>

      {/* Reset Demo Data Action */}
      <div className="p-4 bg-[#FFF4E3]/60 dark:bg-[#25245F]/30 rounded-xl border-2 border-[#E5B25D]/50 dark:border-[#55C7C2]/40 neo-box-sm flex items-center justify-between text-xs transition-colors">
        <div>
          <span className="font-bold text-[#25245F] dark:text-[#55C7C2] block">
            Reset Demo Workspace Data
          </span>
          <span className="text-neutral-600 dark:text-[#C4C3E0] text-[11px]">
            Restores the initial sample sources, claims, and activity logs for evaluation.
          </span>
        </div>
        <button
          onClick={onResetSampleData}
          className="px-3.5 py-1.5 text-xs font-bold text-[#25245F] dark:text-[#FFF4E3] bg-white dark:bg-[#1B1A48] hover:bg-neutral-50 dark:hover:bg-[#25245F] border-2 border-[#25245F]/40 dark:border-[#35337C] rounded-lg shadow-[2px_2px_0px_rgba(37,36,95,0.15)] dark:shadow-[2px_2px_0px_rgba(85,199,194,0.15)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Sample Data</span>
        </button>
      </div>
    </div>
  );
};
