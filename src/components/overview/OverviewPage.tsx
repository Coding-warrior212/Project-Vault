import React from 'react';
import {
  AppPage,
  Workspace,
  WorkflowStage,
  KnowledgeClaim,
  Source,
  ActivityEvent,
} from '../../types';
import {
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  FileCheck2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Plus,
  GitPullRequest,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';

import {
  KnowledgeNetwork3D,
  WorkflowMilestone3D,
} from '../common/Soft3DVisuals';

interface OverviewPageProps {
  currentWorkspace: Workspace;
  workflowStages: WorkflowStage[];
  sources: Source[];
  claims: KnowledgeClaim[];
  activity: ActivityEvent[];
  onNavigate: (page: AppPage) => void;
  onInspectClaim: (claim: KnowledgeClaim) => void;
  onOpenConnectModal: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  currentWorkspace,
  workflowStages,
  sources,
  claims,
  activity,
  onNavigate,
  onInspectClaim,
  onOpenConnectModal,
}) => {
  const verifiedCount = claims.filter((c) => c.verificationStatus === 'verified').length;
  const unverifiedCount = claims.filter((c) => c.verificationStatus === 'unverified').length;
  const conflictedCount = claims.filter((c) => c.verificationStatus === 'conflicted').length;
  const totalClaims = claims.length;

  // Real vs Demo sources tracking
  const userUploadedCount = sources.filter((s) => s.isUserUploaded).length;
  const demoCount = sources.length - userUploadedCount;

  // Find priority claims for recommended actions
  const priorityConflict = claims.find((c) => c.verificationStatus === 'conflicted');
  const priorityUnverified = claims.find((c) => c.verificationStatus === 'unverified');

  return (
    <div className="space-y-6">
      {/* A. Welcome & Project Context Banner with Soft 3D Knowledge Network */}
      <div className="bg-[#25245F] dark:bg-[#181745] text-white rounded-2xl p-6 sm:p-7 border-2 border-[#1B1A48] dark:border-[#2D2C68] shadow-[4px_4px_0px_#1B1A48] dark:shadow-[4px_4px_0px_rgba(85,199,194,0.3)] relative overflow-hidden transition-all">
        {/* Subtle decorative background gradient accent */}
        <div className="absolute -right-12 -top-12 w-80 h-80 rounded-full bg-gradient-to-br from-[#55C7C2]/20 via-[#F36B3F]/15 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-[#F36B3F] text-white font-extrabold shadow-xs">
                DEMO PROJECT — SAMPLE DATA
              </span>
              <span className="text-xs text-white/70">
                Workspace Code: <strong className="text-white font-mono">{currentWorkspace.code}</strong>
              </span>
              <span className="text-white/30">·</span>
              <span className="text-xs text-[#55C7C2] font-semibold">
                {currentWorkspace.projectType}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
              {currentWorkspace.name}
            </h2>

            <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-xl">
              {currentWorkspace.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-white/70 pt-1">
              <span>Owner: <strong className="text-white">{currentWorkspace.role}</strong></span>
              <span>·</span>
              <span>Continuity Target: <strong className="text-[#55C7C2]">Engineering Handover v1.0</strong></span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                onClick={() => onNavigate('review')}
                className="px-4 py-2 text-xs font-bold text-white bg-[#F36B3F] hover:bg-[#E0572C] rounded-lg border border-[#F36B3F] shadow-[2px_2px_0px_#1B1A48] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.5)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-2"
              >
                <span>Review High-Priority Conflicts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('handover')}
                className="px-4 py-2 text-xs font-bold text-white/95 bg-white/10 hover:bg-white/15 rounded-lg border border-white/20 hover:border-white/30 shadow-[2px_2px_0px_rgba(0,0,0,0.25)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
              >
                <span>View Handover Dossier</span>
                <FileCheck2 className="w-3.5 h-3.5 text-[#55C7C2]" />
              </button>
            </div>
          </div>

          {/* Signature Soft 3D Knowledge Network Illustration */}
          <div className="hidden lg:flex flex-col items-center justify-center shrink-0 p-3 bg-white/5 dark:bg-black/20 rounded-xl border border-white/10 backdrop-blur-xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#55C7C2] font-bold mb-1">
              Knowledge Synthesis Matrix
            </div>
            <KnowledgeNetwork3D />
          </div>
        </div>
      </div>

      {/* B. Knowledge Status Summary Cards (Refined Neo-Brutalism & Tactile 3D Depth) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sources */}
        <div
          onClick={() => onNavigate('sources')}
          className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm hover:border-[#25245F] dark:hover:border-[#55C7C2] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] group"
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-[#8E8DAF] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-[#C4C3E0]">
              Connected Sources
            </span>
            <div className="p-2 rounded-lg bg-neutral-100 dark:bg-[#14133B] text-[#25245F] dark:text-[#55C7C2] border border-neutral-200 dark:border-[#2D2C68] soft-3d-clay group-hover:bg-[#25245F] dark:group-hover:bg-[#55C7C2] group-hover:text-white dark:group-hover:text-[#25245F] transition-colors">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-neutral-900 dark:text-[#FFF4E3] tabular-nums">
              {sources.length}
            </span>
            <span className="text-xs text-neutral-500 dark:text-[#8E8DAF] font-medium">sources connected</span>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            {userUploadedCount > 0 ? (
              <>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                  {userUploadedCount} Uploaded (Real)
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-[#8E8DAF] font-mono">
                  + {demoCount} demo
                </span>
              </>
            ) : (
              <span className="text-[10px] font-mono text-neutral-500 dark:text-[#8E8DAF]">
                {sources.length} demo artifacts
              </span>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-[#2D2C68] flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF]">
            <span>PDFs, Markdown, TXT</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 2: Supported / Verified Claims */}
        <div
          onClick={() => onNavigate('ledger')}
          className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-emerald-300 dark:border-emerald-600/60 neo-box-sm hover:border-emerald-500 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] group"
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-[#8E8DAF] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Supported Claims
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 soft-3d-clay group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-neutral-900 dark:text-[#FFF4E3] tabular-nums">
              {verifiedCount}
            </span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
              / {totalClaims} grounded ({Math.round((verifiedCount / totalClaims) * 100)}%)
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-[#2D2C68] flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF]">
            <span>Traceable to source excerpts</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 3: Unverified Claims */}
        <div
          onClick={() => onNavigate('review')}
          className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-amber-300 dark:border-amber-600/60 neo-box-sm hover:border-amber-500 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] group"
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-[#8E8DAF] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Unverified Claims
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 soft-3d-clay group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-neutral-900 dark:text-[#FFF4E3] tabular-nums">
              {unverifiedCount}
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold font-mono">awaiting signoff</span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-[#2D2C68] flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF]">
            <span>Requires architect approval</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 4: Conflicting Claims */}
        <div
          onClick={() => onNavigate('review')}
          className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-[#F36B3F] neo-box-orange hover:border-[#D94E22] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] group"
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-[#8E8DAF] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#F36B3F]">
              Conflicting Claims
            </span>
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#F36B3F] border border-orange-200 dark:border-orange-900/50 soft-3d-clay group-hover:bg-[#F36B3F] group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-neutral-900 dark:text-[#FFF4E3] tabular-nums">
              {conflictedCount}
            </span>
            <span className="text-xs text-[#F36B3F] font-bold font-mono">critical conflicts</span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-[#2D2C68] flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF]">
            <span>Contradicting sources detected</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* C. Workflow Progress Pipeline with Soft 3D Milestone Badges */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-2xl p-6 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-sm font-extrabold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-2">
              <span>Project Continuity Workflow Pipeline</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#55C7C2]/15 text-[#25245F] dark:text-[#55C7C2] rounded border border-[#55C7C2]/30 font-bold">
                CONNECT → RECONSTRUCT → VERIFY → REVIEW → HANDOVER
              </span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
              From raw documentation chaos to human-verified project handover.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#25245F] dark:text-[#FFF4E3] font-bold bg-[#FFF4E3] dark:bg-[#14133B] px-3 py-1.5 rounded-lg border border-[#E5B25D]/50 shadow-xs">
            <span>Stage 4 of 5 Active · Human Review</span>
          </div>
        </div>

        {/* 5-Stage Stepper Container */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {workflowStages.map((stage) => {
            const isCompleted = stage.status === 'completed';
            const isInProgress = stage.status === 'in_progress';
            const isAwaiting = stage.status === 'awaiting';

            // Dynamic live metric display from single source of truth
            const getStageMetric = () => {
              switch (stage.id) {
                case 'CONNECT':
                  return userUploadedCount > 0
                    ? `${userUploadedCount} uploaded (${demoCount} demo)`
                    : `${sources.length} demo sources`;
                case 'RECONSTRUCT':
                  return `${claims.length} claims synthesized`;
                case 'VERIFY':
                  return `${claims.length} anchored & scored`;
                case 'REVIEW':
                  return `${unverifiedCount + conflictedCount} pending · ${conflictedCount} conflicts`;
                case 'HANDOVER':
                  return `${verifiedCount} of ${claims.length} approved (${Math.round((verifiedCount / claims.length) * 100)}%)`;
                default:
                  return stage.metrics;
              }
            };

            return (
              <div
                key={stage.id}
                onClick={() => onNavigate(stage.targetPage)}
                className={`p-4 rounded-xl border-2 text-left cursor-pointer transition-all relative ${
                  isInProgress
                    ? 'border-[#F36B3F] bg-orange-50/40 dark:bg-orange-950/20 neo-box-orange ring-1 ring-[#F36B3F]/30'
                    : isCompleted
                    ? 'border-neutral-300 dark:border-[#2D2C68] bg-neutral-50/70 dark:bg-[#14133B]/80 hover:border-[#25245F] dark:hover:border-[#55C7C2] neo-box-sm'
                    : 'border-neutral-200 dark:border-[#2D2C68] bg-white dark:bg-[#14133B] hover:border-neutral-400 dark:hover:border-[#35337C]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  {/* Soft 3D Milestone Glyph */}
                  <WorkflowMilestone3D
                    step={stage.stepNumber}
                    status={stage.status}
                    size="sm"
                  />
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Complete
                    </span>
                  ) : isInProgress ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F36B3F] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F36B3F] animate-ping" />
                      Active
                    </span>
                  ) : isAwaiting ? (
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 font-mono">
                      Awaiting
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                      Planned
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 font-bold">
                    0{stage.stepNumber}
                  </span>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-[#FFF4E3]">
                    {stage.name}
                  </h4>
                </div>

                <p className="text-[11px] text-neutral-600 dark:text-[#C4C3E0] line-clamp-2 mb-2 leading-relaxed">
                  {stage.description}
                </p>

                <div className="pt-2 border-t border-neutral-200/60 dark:border-[#2D2C68] flex items-center justify-between text-[11px] text-neutral-500 dark:text-[#8E8DAF] font-mono">
                  <span className="truncate">{getStageMetric()}</span>
                  <ArrowRight className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* D & E: 2-Column Split: Recommended Next Actions + Recent Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recommended Next Actions (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1B1A48] rounded-xl p-6 border border-neutral-200 dark:border-[#2D2C68] shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#2D2C68]">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3]">
                Recommended Actions
              </h3>
              <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
                High-leverage tasks to move this project toward an audit-ready handover.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#25245F] dark:text-[#E5B25D] bg-[#FFF4E3] dark:bg-[#14133B] px-2.5 py-0.5 rounded-md border border-transparent dark:border-[#E5B25D]/30">
              Priority Queue
            </span>
          </div>

          <div className="space-y-3">
            {/* Action 1: Resolve high-priority conflict */}
            {priorityConflict && (
              <div className="p-4 rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/70 dark:hover:bg-orange-950/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-[#F36B3F] bg-white dark:bg-[#14133B] px-2 py-0.5 rounded border border-orange-200 dark:border-orange-900/50">
                      HIGH RISK CONFLICT
                    </span>
                    <span className="text-xs font-mono text-neutral-600 dark:text-[#8E8DAF]">
                      {priorityConflict.id}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-[#FFF4E3]">
                    Kafka vs AWS Kinesis Streaming Backbone Discrepancy
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] line-clamp-1">
                    {priorityConflict.statement}
                  </p>
                </div>
                <button
                  onClick={() => onInspectClaim(priorityConflict)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#F36B3F] hover:bg-[#E0572C] rounded-lg shadow-xs transition-colors shrink-0 whitespace-nowrap"
                >
                  Inspect Conflict
                </button>
              </div>
            )}

            {/* Action 2: Review an uncertain claim */}
            {priorityUnverified && (
              <div className="p-4 rounded-lg border border-neutral-200 dark:border-[#2D2C68] bg-neutral-50/50 dark:bg-[#14133B] hover:bg-neutral-50 dark:hover:bg-[#161540] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                      AWAITING SIGNOFF
                    </span>
                    <span className="text-xs font-mono text-neutral-600 dark:text-[#8E8DAF]">
                      {priorityUnverified.id}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-[#FFF4E3]">
                    Verify Disaster Recovery RPO/RTO Targets
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] line-clamp-1">
                    {priorityUnverified.statement}
                  </p>
                </div>
                <button
                  onClick={() => onInspectClaim(priorityUnverified)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 dark:text-[#FFF4E3] bg-white dark:bg-[#1B1A48] hover:bg-neutral-100 dark:hover:bg-[#25245F] border border-neutral-300 dark:border-[#2D2C68] rounded-lg transition-colors shrink-0 whitespace-nowrap"
                >
                  Review Claim
                </button>
              </div>
            )}

            {/* Action 3: Connect another source */}
            <div className="p-4 rounded-lg border border-neutral-200 dark:border-[#2D2C68] bg-white dark:bg-[#14133B] hover:border-[#25245F]/30 dark:hover:border-[#55C7C2]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-[#25245F] dark:text-[#55C7C2] bg-[#FFF4E3] dark:bg-[#1B1A48] px-2 py-0.5 rounded border border-[#E5B25D]/40 dark:border-[#2D2C68]">
                    SOURCE REPOSITORY
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-[#8E8DAF]">6 ingested</span>
                </div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-[#FFF4E3]">
                  Connect Additional Project Artifacts
                </h4>
                <p className="text-xs text-neutral-600 dark:text-[#C4C3E0]">
                  Import Terraform modules, PR descriptions, or sprint notes for higher evidence density.
                </p>
              </div>
              <button
                onClick={onOpenConnectModal}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#25245F] hover:bg-[#1B1A48] dark:bg-[#F36B3F] dark:hover:bg-[#E0572C] rounded-lg shadow-xs transition-colors shrink-0 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#55C7C2] dark:text-white" />
                <span>Connect Source</span>
              </button>
            </div>

            {/* Action 4: Draft Handover */}
            <div className="p-4 rounded-lg border border-neutral-200 dark:border-[#2D2C68] bg-white dark:bg-[#14133B] hover:border-[#25245F]/30 dark:hover:border-[#55C7C2]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-[#55C7C2] bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-900/50">
                    HANDOVER PACKAGE
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-[#8E8DAF]">Target v1.0</span>
                </div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-[#FFF4E3]">
                  Generate Structured Handover Package
                </h4>
                <p className="text-xs text-neutral-600 dark:text-[#C4C3E0]">
                  Assemble verified ADRs, runbooks, and risk registers into exportable Markdown & JSON.
                </p>
              </div>
              <button
                onClick={() => onNavigate('handover')}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#25245F] dark:text-[#FFF4E3] bg-[#FFF4E3] dark:bg-[#25245F] hover:bg-[#FFE8C2] dark:hover:bg-[#2D2C6E] border border-[#E5B25D]/50 dark:border-white/10 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
                <span>Open Handover</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Recent Activity Timeline (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1B1A48] rounded-xl p-6 border border-neutral-200 dark:border-[#2D2C68] shadow-xs space-y-4 flex flex-col transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#2D2C68]">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3]">
                Recent Audit Activity
              </h3>
              <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
                Provenance changes and verification events.
              </p>
            </div>
            <Clock className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
          </div>

          <div className="flex-1 space-y-4">
            {activity.map((event) => {
              const getIcon = () => {
                switch (event.type) {
                  case 'claim_verified':
                    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
                  case 'conflict_detected':
                    return <AlertTriangle className="w-3.5 h-3.5 text-[#F36B3F]" />;
                  case 'source_ingested':
                    return <FolderGit2 className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />;
                  default:
                    return <Sparkles className="w-3.5 h-3.5 text-[#55C7C2]" />;
                }
              };

              return (
                <div key={event.id} className="flex gap-3 text-xs relative group">
                  {/* Timeline bullet */}
                  <div className="mt-0.5 p-1.5 rounded-md bg-neutral-100 dark:bg-[#14133B] shrink-0 flex items-center justify-center">
                    {getIcon()}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">
                        {event.title}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-[#8E8DAF] whitespace-nowrap">
                        {event.timestamp}
                      </span>
                    </div>

                    <p className="text-neutral-600 dark:text-[#C4C3E0] text-[11px] leading-relaxed">
                      {event.description}
                    </p>

                    <div className="text-[10px] text-neutral-400 dark:text-[#8E8DAF] pt-0.5 flex items-center gap-1">
                      <span>By: {event.actor}</span>
                      {event.claimId && (
                        <>
                          <span>·</span>
                          <button
                            onClick={() => {
                              const found = claims.find((c) => c.id === event.claimId);
                              if (found) onInspectClaim(found);
                            }}
                            className="font-mono text-[#25245F] dark:text-[#55C7C2] hover:underline"
                          >
                            Inspect {event.claimId}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-[#2D2C68] text-center">
            <span className="text-[11px] text-neutral-400 dark:text-[#8E8DAF]">
              Audit log continuously recorded for regulatory compliance
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
