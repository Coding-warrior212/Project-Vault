/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  KnowledgeClaim,
  VerificationStatus,
  ProjectConflict,
  MissingInfoFinding,
  UnresolvedQuestion,
} from '../../types';
import {
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Quote,
  Clock,
  User,
  ArrowRight,
  SlidersHorizontal,
  Info,
  Check,
  Flag,
  Sparkles,
  HelpCircle as QuestionIcon,
  Layers,
  FileCheck,
  Search,
  MessageSquare,
  CheckCircle,
  X,
} from 'lucide-react';

interface ReviewPageProps {
  claims: KnowledgeClaim[];
  conflicts: ProjectConflict[];
  missingInfo: MissingInfoFinding[];
  questions: UnresolvedQuestion[];
  isAnalyzingConflicts?: boolean;
  conflictAnalysisResult?: { analyzed: number; discovered: number; timestamp: string } | null;
  onRunConflictAnalysis?: () => void;
  onUpdateClaimStatus: (
    claimId: string,
    newStatus: VerificationStatus,
    note?: string
  ) => void;
  onNavigateToSources: (sourceId?: string) => void;
  onToggleFlagClaim?: (claimId: string) => void;
  onUpdateConflictStatus: (conflictId: string, status: ProjectConflict['status'], note?: string) => void;
  onUpdateMissingInfoStatus: (itemId: string, status: MissingInfoFinding['status']) => void;
  onUpdateQuestion: (qId: string, status: UnresolvedQuestion['status'], answer?: string) => void;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({
  claims,
  conflicts = [],
  missingInfo = [],
  questions = [],
  isAnalyzingConflicts = false,
  conflictAnalysisResult = null,
  onRunConflictAnalysis,
  onUpdateClaimStatus,
  onNavigateToSources,
  onToggleFlagClaim,
  onUpdateConflictStatus,
  onUpdateMissingInfoStatus,
  onUpdateQuestion,
}) => {
  // Main Review Sub-Workspace Tab: 'conflicts' | 'missing' | 'questions' | 'quality' | 'claims'
  const [activeReviewTab, setActiveReviewTab] = React.useState<'conflicts' | 'missing' | 'questions' | 'quality' | 'claims'>('conflicts');

  // Claim Verification Queue sub-state
  const [claimFilterType, setClaimFilterType] = React.useState<'all' | 'conflicted' | 'unverified' | 'resolved'>('all');
  const [selectedClaimId, setSelectedClaimId] = React.useState<string | null>(null);
  const [reviewNote, setReviewNote] = React.useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = React.useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  // Question Answer Modal / Inline state
  const [answeringQId, setAnsweringQId] = React.useState<string | null>(null);
  const [answerText, setAnswerText] = React.useState<string>('');

  // Conflict resolution note modal state
  const [resolvingConflictId, setResolvingConflictId] = React.useState<string | null>(null);
  const [conflictNote, setConflictNote] = React.useState<string>('');

  // Counts
  const openConflictsCount = conflicts.filter((c) => c.status === 'open').length;
  const openMissingCount = missingInfo.filter((m) => m.status === 'open').length;
  const openQuestionsCount = questions.filter((q) => q.status === 'open').length;
  const unverifiedCount = claims.filter((c) => c.verificationStatus === 'unverified').length;
  const flaggedCount = claims.filter((c) => c.isFlagged).length;
  const lowConfidenceCount = claims.filter((c) => c.confidenceScore < 70).length;
  const conflictedCount = claims.filter((c) => c.verificationStatus === 'conflicted').length;
  const resolvedCount = claims.filter((c) => c.verificationStatus === 'verified' || c.verificationStatus === 'rejected').length;
  const totalCount = claims.length;

  // Claim review queue filtering
  const reviewQueue = claims.filter((claim) => {
    if (claimFilterType === 'all') return true;
    if (claimFilterType === 'conflicted') return claim.verificationStatus === 'conflicted';
    if (claimFilterType === 'unverified') return claim.verificationStatus === 'unverified';
    if (claimFilterType === 'resolved') return claim.verificationStatus === 'verified' || claim.verificationStatus === 'rejected';
    return true;
  });

  const activeClaim =
    reviewQueue.find((c) => c.id === selectedClaimId) || reviewQueue[0] || null;

  React.useEffect(() => {
    if (activeClaim) {
      setReviewNote(activeClaim.humanReviewNotes || '');
    }
  }, [activeClaim?.id]);

  const handleDecision = (newStatus: VerificationStatus) => {
    if (!activeClaim) return;

    onUpdateClaimStatus(activeClaim.id, newStatus, reviewNote);

    const actionText =
      newStatus === 'verified'
        ? `Claim ${activeClaim.id} marked Verified & Approved`
        : newStatus === 'rejected'
        ? `Claim ${activeClaim.id} marked Rejected`
        : `Claim ${activeClaim.id} status updated to ${newStatus}`;

    setFeedbackMessage({
      text: actionText,
      type: newStatus === 'verified' ? 'success' : 'warn',
    });

    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Verified & Approved
          </span>
        );
      case 'conflicted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F36B3F] bg-orange-50 dark:bg-orange-950/40 px-2.5 py-0.5 rounded border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F36B3F]" />
            Direct Conflict
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Awaiting Signoff
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Human In The Loop Principle Banner with Explicit Stage 4 Indicator */}
      <div className="bg-[#25245F] text-white rounded-xl p-5 border-2 border-[#1B1A48] dark:border-[#55C7C2]/40 shadow-[4px_4px_0px_#F36B3F] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 bg-[#F36B3F] text-white rounded border border-[#F36B3F]">
              Stage 4 / 5 · REVIEW
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-white/10 text-white/90 rounded border border-white/20 font-semibold">
              INTELLIGENT KNOWLEDGE REVIEW ENGINE
            </span>
            <span className="text-white/40">·</span>
            <span className="text-xs text-[#55C7C2] font-semibold">
              Human-in-the-Loop Governance
            </span>
          </div>
          <h2 className="text-base font-bold text-white">
            Project Continuity & Knowledge Review Workbench
          </h2>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            Examine extracted project assertions, detect contradictory statements co-anchored to source evidence, identify missing information gaps, resolve open questions, and perform rigorous quality audits before handover.
          </p>
        </div>

        {/* Health Counters Summary */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
          <div className="bg-white/10 px-3 py-2 rounded-lg border-2 border-white/15 text-center">
            <span className="block text-[10px] text-white/60 uppercase font-mono">Conflicts</span>
            <span className="font-mono font-bold text-sm text-[#F36B3F]">
              {openConflictsCount} open
            </span>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-lg border-2 border-white/15 text-center">
            <span className="block text-[10px] text-white/60 uppercase font-mono">Missing Gaps</span>
            <span className="font-mono font-bold text-sm text-[#FFF4E3]">
              {openMissingCount} gaps
            </span>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-lg border-2 border-white/15 text-center">
            <span className="block text-[10px] text-white/60 uppercase font-mono">Open Questions</span>
            <span className="font-mono font-bold text-sm text-[#55C7C2]">
              {openQuestionsCount} qns
            </span>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-lg border-2 border-white/15 text-center">
            <span className="block text-[10px] text-white/60 uppercase font-mono">Unverified</span>
            <span className="font-mono font-bold text-sm text-amber-300">
              {unverifiedCount} claims
            </span>
          </div>
        </div>
      </div>

      {/* Temporary Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg border-2 text-xs flex items-center justify-between shadow-[2px_2px_0px_rgba(0,0,0,0.1)] animate-in fade-in duration-150 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Review Engine Sub-Workspace Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#1B1A48] p-2 rounded-xl border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm transition-colors">
        {[
          { id: 'conflicts', label: `Contradictions & Conflicts (${openConflictsCount})`, icon: AlertTriangle, color: 'text-[#F36B3F]' },
          { id: 'missing', label: `Missing Information (${openMissingCount})`, icon: Layers, color: 'text-amber-600 dark:text-amber-400' },
          { id: 'questions', label: `Unresolved Questions (${openQuestionsCount})`, icon: QuestionIcon, color: 'text-[#55C7C2]' },
          { id: 'quality', label: `Knowledge Quality Audit`, icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400' },
          { id: 'claims', label: `Claim Verification Queue (${unverifiedCount})`, icon: FileCheck, color: 'text-purple-600 dark:text-purple-400' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReviewTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReviewTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#25245F] dark:bg-[#2D2B75] text-white shadow-xs border-2 border-[#25245F] dark:border-[#55C7C2]'
                  : 'bg-neutral-100 dark:bg-[#14133B] text-neutral-700 dark:text-[#C4C3E0] hover:bg-neutral-200 dark:hover:bg-[#222158] border-2 border-neutral-300 dark:border-[#2D2C68]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#55C7C2]' : tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================== */}
      {/* TAB 1: CONFLICT DETECTION ENGINE */}
      {/* ========================================================== */}
      {activeReviewTab === 'conflicts' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-neutral-200 dark:border-[#2D2C68]">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#F36B3F]" />
                  Contradiction & Conflict Detection Engine
                </h3>
                <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] mt-0.5">
                  Gemini and algorithmic auditing scans all reconstructed source artifacts for contradictory technical decisions, architecture contracts, and requirements.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {onRunConflictAnalysis && (
                  <button
                    onClick={onRunConflictAnalysis}
                    disabled={isAnalyzingConflicts}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#F36B3F] hover:bg-[#E0572C] disabled:bg-neutral-400 rounded-lg shadow-[2px_2px_0px_#25245F] dark:shadow-[2px_2px_0px_#55C7C2] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Run Gemini dynamic conflict detection across persisted knowledge claims"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingConflicts ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzingConflicts ? 'Analyzing Conflicts...' : 'Analyze Knowledge Conflicts'}</span>
                  </button>
                )}
                <span className="text-xs font-mono font-bold px-3 py-1 bg-orange-50 dark:bg-orange-950/50 text-[#F36B3F] rounded border border-orange-200 dark:border-orange-800">
                  {conflicts.filter(c => c.status === 'open').length} Active Conflicts
                </span>
              </div>
            </div>

            {conflictAnalysisResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300 text-xs rounded-lg flex items-center justify-between">
                <span>
                  <strong>Analysis Complete ({conflictAnalysisResult.timestamp}):</strong> Analyzed {conflictAnalysisResult.analyzed} claims. Discovered {conflictAnalysisResult.discovered} new conflicting pair(s).
                </span>
                <span className="font-mono font-bold text-[11px]">Gemini 3.8 Flash</span>
              </div>
            )}

            {conflicts.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-neutral-800 dark:text-[#FFF4E3]">No Contradictions Detected</h4>
                <p className="text-[11px] text-neutral-500 dark:text-[#8E8DAF]">All project knowledge claims are currently consistent with source documentation.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {conflicts.map((conflict) => {
                  const isOpen = conflict.status === 'open';
                  return (
                    <div
                      key={conflict.id}
                      className={`p-5 rounded-xl border-2 transition-all space-y-3 ${
                        isOpen
                          ? 'bg-orange-50/40 dark:bg-orange-950/20 border-orange-300 dark:border-orange-900/50 shadow-[3px_3px_0px_rgba(243,107,63,0.15)]'
                          : 'bg-neutral-50 dark:bg-[#14133B] border-neutral-300 dark:border-[#2D2C68] opacity-75'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-neutral-800 dark:text-[#FFF4E3]">{conflict.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            conflict.severity === 'HIGH'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300'
                              : conflict.severity === 'MEDIUM'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300'
                              : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300'
                          }`}>
                            {conflict.severity} SEVERITY
                          </span>
                          <span className="text-neutral-300 dark:text-neutral-600">·</span>
                          <span className="font-semibold text-neutral-700 dark:text-[#C4C3E0]">Status: <span className="uppercase">{conflict.status}</span></span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <button
                              onClick={() => onUpdateConflictStatus(conflict.id, 'resolved', 'Resolved by lead architect signoff')}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Resolved</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onUpdateConflictStatus(conflict.id, 'open')}
                              className="px-3 py-1.5 text-xs font-bold text-neutral-700 dark:text-[#C4C3E0] bg-white dark:bg-[#25245F] border border-neutral-300 dark:border-[#35337C] rounded-lg hover:bg-neutral-100 transition-all cursor-pointer"
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            onClick={() => onUpdateConflictStatus(conflict.id, 'dismissed')}
                            className="px-2.5 py-1.5 text-xs text-neutral-500 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3]">
                        {conflict.title}
                      </h4>
                      <p className="text-xs text-neutral-700 dark:text-[#C4C3E0] leading-relaxed">
                        {conflict.description}
                      </p>

                      {/* Supporting Evidence Side-by-Side */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {conflict.supportingEvidence.map((ev, idx) => (
                          <div key={idx} className="bg-white dark:bg-[#14133B] p-3 rounded-lg border border-orange-200 dark:border-[#2D2C68] space-y-1.5 text-xs">
                            <span className="font-mono text-[10px] text-[#F36B3F] font-bold block truncate">
                              {conflict.sourceReferences[idx] || `Source Ref #${idx + 1}`}
                            </span>
                            <blockquote className="pl-2 border-l-2 border-[#F36B3F] text-neutral-800 dark:text-[#C4C3E0] italic text-[11px] leading-relaxed">
                              "{ev}"
                            </blockquote>
                          </div>
                        ))}
                      </div>

                      {conflict.resolvedNote && (
                        <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-800 font-medium">
                          <strong>Resolution Note:</strong> {conflict.resolvedNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: MISSING INFORMATION */}
      {/* ========================================================== */}
      {activeReviewTab === 'missing' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-neutral-200 dark:border-[#2D2C68]">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  Missing Project Knowledge & Architecture Gaps
                </h3>
                <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] mt-0.5">
                  Identified blind spots and incomplete specifications across essential project handover categories.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800">
                {missingInfo.filter(m => m.status === 'open').length} Open Gaps
              </span>
            </div>

            {missingInfo.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-neutral-800 dark:text-[#FFF4E3]">No Critical Knowledge Gaps Detected</h4>
              </div>
            ) : (
              <div className="space-y-4">
                {missingInfo.map((item) => {
                  const isOpen = item.status === 'open';
                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-xl border-2 transition-all space-y-3 ${
                        isOpen
                          ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/50 shadow-[3px_3px_0px_rgba(217,119,6,0.15)]'
                          : 'bg-neutral-50 dark:bg-[#14133B] border-neutral-300 dark:border-[#2D2C68] opacity-75'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-neutral-800 dark:text-[#FFF4E3]">{item.id}</span>
                          <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-[#25245F] text-neutral-800 dark:text-[#FFF4E3] font-semibold">
                            {item.category}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            item.severity === 'high'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300'
                          }`}>
                            {item.severity} IMPACT
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <button
                              onClick={() => onUpdateMissingInfoStatus(item.id, 'resolved')}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Addressed</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onUpdateMissingInfoStatus(item.id, 'open')}
                              className="px-3 py-1.5 text-xs font-bold text-neutral-700 dark:text-[#C4C3E0] bg-white dark:bg-[#25245F] border border-neutral-300 dark:border-[#35337C] rounded-lg hover:bg-neutral-100 transition-all cursor-pointer"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3]">
                        {item.title}
                      </h4>
                      <p className="text-xs text-neutral-700 dark:text-[#C4C3E0] leading-relaxed">
                        {item.description}
                      </p>

                      <div className="bg-white dark:bg-[#14133B] p-3 rounded-lg border border-amber-200 dark:border-[#2D2C68] space-y-1 text-xs">
                        <span className="font-bold text-neutral-800 dark:text-[#FFF4E3] uppercase text-[10px] tracking-wider block text-amber-700 dark:text-amber-400">
                          Why This Matters for Handover
                        </span>
                        <p className="text-neutral-700 dark:text-[#C4C3E0] leading-relaxed">
                          {item.whyItMatters}
                        </p>
                      </div>

                      {item.actionSuggestion && (
                        <div className="text-[11px] text-[#25245F] dark:text-[#55C7C2] font-semibold bg-[#FFF4E3]/60 dark:bg-[#25245F]/60 p-2 rounded border border-[#E5B25D]/40">
                          <strong>Recommended Action:</strong> {item.actionSuggestion}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: UNRESOLVED QUESTIONS */}
      {/* ========================================================== */}
      {activeReviewTab === 'questions' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-neutral-200 dark:border-[#2D2C68]">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-2">
                  <QuestionIcon className="w-4 h-4 text-[#55C7C2]" />
                  Unresolved Project Questions & Incoming Team Inquiry
                </h3>
                <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] mt-0.5">
                  Actionable architectural questions derived from documentation gaps and conflicts. Answer or clarify for incoming teams.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-teal-50 dark:bg-teal-950/50 text-[#55C7C2] rounded border border-teal-200 dark:border-teal-800">
                {questions.filter(q => q.status === 'open').length} Open Questions
              </span>
            </div>

            {questions.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-neutral-800 dark:text-[#FFF4E3]">No Open Questions</h4>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q) => {
                  const isAnswering = answeringQId === q.id;
                  const isAnswered = q.status === 'answered';

                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-xl border-2 bg-neutral-50 dark:bg-[#14133B] border-neutral-300 dark:border-[#2D2C68] space-y-3 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-[#25245F] dark:text-[#55C7C2]">{q.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isAnswered
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300'
                          }`}>
                            {q.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          {!isAnswering ? (
                            <button
                              onClick={() => {
                                setAnsweringQId(q.id);
                                setAnswerText(q.answer || '');
                              }}
                              className="px-3 py-1.5 font-bold text-white bg-[#25245F] dark:bg-[#55C7C2] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{isAnswered ? 'Edit Answer' : 'Answer Question'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setAnsweringQId(null)}
                              className="px-3 py-1.5 text-neutral-600 dark:text-[#C4C3E0] hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3]">
                        {q.question}
                      </h4>
                      <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] italic">
                        Context: {q.context}
                      </p>

                      {isAnswered && !isAnswering && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                            <span>Answered by {q.answeredBy || 'Lead Architect'} ({q.answeredAt || 'Recently'})</span>
                          </div>
                          <p className="text-neutral-800 dark:text-[#FFF4E3] font-medium leading-relaxed">
                            {q.answer}
                          </p>
                        </div>
                      )}

                      {isAnswering && (
                        <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-[#2D2C68]">
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Provide architectural rationale, documentation link, or definitive answer for incoming engineers..."
                            className="w-full text-xs p-3 bg-white dark:bg-[#1B1A48] border-2 border-neutral-300 dark:border-[#35337C] text-neutral-900 dark:text-[#FFF4E3] rounded-lg focus:outline-none focus:border-[#25245F]"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                onUpdateQuestion(q.id, 'answered', answerText);
                                setAnsweringQId(null);
                              }}
                              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                            >
                              Save Answer & Mark Answered
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 4: KNOWLEDGE QUALITY REVIEW AUDIT */}
      {/* ========================================================== */}
      {activeReviewTab === 'quality' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-6 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-6 transition-colors">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Comprehensive Knowledge Quality & Health Audit
              </h3>
              <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] mt-1">
                Rigorous breakdown of atomic claims by verification tier, confidence level, flag status, and citation backing.
              </p>
            </div>

            {/* Quality Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-neutral-50 dark:bg-[#14133B] p-4 rounded-xl border-2 border-neutral-200 dark:border-[#2D2C68] text-center space-y-1">
                <span className="text-[10px] uppercase font-mono text-neutral-500 dark:text-[#8E8DAF] block">Verified & Approved</span>
                <span className="font-mono font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                  {claims.filter(c => c.verificationStatus === 'verified').length}
                </span>
                <span className="text-[10px] text-neutral-400 block">Ready for handover</span>
              </div>

              <div className="bg-neutral-50 dark:bg-[#14133B] p-4 rounded-xl border-2 border-neutral-200 dark:border-[#2D2C68] text-center space-y-1">
                <span className="text-[10px] uppercase font-mono text-neutral-500 dark:text-[#8E8DAF] block">Awaiting Unverified</span>
                <span className="font-mono font-bold text-2xl text-amber-600 dark:text-amber-400">
                  {unverifiedCount}
                </span>
                <span className="text-[10px] text-neutral-400 block">Needs human signoff</span>
              </div>

              <div className="bg-neutral-50 dark:bg-[#14133B] p-4 rounded-xl border-2 border-neutral-200 dark:border-[#2D2C68] text-center space-y-1">
                <span className="text-[10px] uppercase font-mono text-neutral-500 dark:text-[#8E8DAF] block">Flagged for Review</span>
                <span className="font-mono font-bold text-2xl text-[#F36B3F]">
                  {flaggedCount}
                </span>
                <span className="text-[10px] text-neutral-400 block">Independently flagged</span>
              </div>

              <div className="bg-neutral-50 dark:bg-[#14133B] p-4 rounded-xl border-2 border-neutral-200 dark:border-[#2D2C68] text-center space-y-1">
                <span className="text-[10px] uppercase font-mono text-neutral-500 dark:text-[#8E8DAF] block">Low Confidence (&lt;70%)</span>
                <span className="font-mono font-bold text-2xl text-rose-600 dark:text-rose-400">
                  {lowConfidenceCount}
                </span>
                <span className="text-[10px] text-neutral-400 block">Requires manual audit</span>
              </div>
            </div>

            {/* Quality Audit Invariant Notes */}
            <div className="bg-[#FFF4E3]/60 dark:bg-[#14133B] border-2 border-[#E5B25D]/50 dark:border-[#55C7C2]/30 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#25245F] dark:text-[#55C7C2]">
                Governance & Safety Invariants Enforced
              </h4>
              <ul className="text-xs text-neutral-700 dark:text-[#C4C3E0] space-y-1.5 list-disc list-inside leading-relaxed">
                <li><strong>Flag Independence:</strong> Flagged claims remain flagged without automatically altering verification status or triggering rejection.</li>
                <li><strong>Unverified Safety:</strong> AI-reconstructed claims remain unverified until explicitly signed off by a human architect.</li>
                <li><strong>Rejected Isolation:</strong> Rejected assertions are strictly isolated and never included as accepted project facts in the handover dossier.</li>
                <li><strong>Evidence Traceability:</strong> All claims maintain direct citations and verbatim quotes to source documents.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 5: CLAIM VERIFICATION QUEUE */}
      {/* ========================================================== */}
      {activeReviewTab === 'claims' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Review Queue (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm flex flex-col overflow-hidden transition-colors">
            <div className="p-3 border-b-2 border-neutral-200 dark:border-[#2D2C68] bg-neutral-50/50 dark:bg-[#14133B]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 dark:text-[#FFF4E3] uppercase tracking-wider">
                  Verification Queue
                </span>
                <span className="text-xs text-neutral-500 dark:text-[#8E8DAF] font-mono">
                  {reviewQueue.length} of {totalCount} claims shown
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-200/60 dark:bg-[#14133B] rounded-lg text-xs border border-neutral-300 dark:border-[#2D2C68]">
                {[
                  { id: 'all', label: `All (${totalCount})` },
                  { id: 'conflicted', label: `Conflicts (${conflictedCount})` },
                  { id: 'unverified', label: `Unverified (${unverifiedCount})` },
                  { id: 'resolved', label: `Resolved (${resolvedCount})` },
                ].map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setClaimFilterType(tb.id as any)}
                    className={`py-1 text-center rounded-md font-medium transition-colors cursor-pointer ${
                      claimFilterType === tb.id
                        ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                        : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Claims List */}
            <div className="divide-y divide-neutral-200 dark:divide-[#2D2C68] max-h-[640px] overflow-y-auto">
              {reviewQueue.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <div className="text-xs font-bold text-neutral-800 dark:text-[#FFF4E3]">No items in this queue</div>
                </div>
              ) : (
                reviewQueue.map((claim) => {
                  const isSelected = activeClaim?.id === claim.id;

                  return (
                    <div
                      key={claim.id}
                      onClick={() => setSelectedClaimId(claim.id)}
                      className={`p-3.5 cursor-pointer transition-colors text-left space-y-1.5 ${
                        isSelected
                          ? 'bg-[#FFF4E3]/70 dark:bg-[#25245F] border-l-4 border-[#F36B3F]'
                          : 'hover:bg-neutral-50 dark:hover:bg-[#222158]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#25245F] dark:text-[#55C7C2]">
                            {claim.id}
                          </span>
                          {claim.isFlagged && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-400">
                              <Flag className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                              FLAGGED
                            </span>
                          )}
                          <span className="text-neutral-300 dark:text-neutral-600">·</span>
                          <span className="text-neutral-600 dark:text-[#C4C3E0] font-medium">
                            {claim.category}
                          </span>
                        </div>
                        <div>{getStatusBadge(claim.verificationStatus)}</div>
                      </div>

                      <p className="text-xs text-neutral-900 dark:text-[#FFF4E3] font-medium line-clamp-2 leading-relaxed">
                        {claim.statement}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-[#8E8DAF] pt-1 font-mono">
                        <span className="truncate max-w-[200px]">{claim.sourceName}</span>
                        <span className="text-neutral-700 dark:text-[#C4C3E0] font-semibold">{claim.confidenceScore}% conf</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Evidence Inspector & Resolution Workbench (7 cols) */}
          {activeClaim ? (
            <div className="lg:col-span-7 bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm p-6 space-y-6 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-neutral-200 dark:border-[#2D2C68]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-sm text-[#25245F] dark:text-[#55C7C2]">
                      {activeClaim.id}
                    </span>
                    {activeClaim.isFlagged && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-400">
                        <Flag className="w-3 h-3 fill-amber-500 text-amber-600" />
                        FLAGGED
                      </span>
                    )}
                    <span className="text-neutral-400 dark:text-[#8E8DAF]">·</span>
                    <span className="text-neutral-600 dark:text-[#C4C3E0] font-medium">{activeClaim.category}</span>
                    <span className="text-neutral-400 dark:text-[#8E8DAF]">·</span>
                    <span className="text-xs text-[#55C7C2] font-semibold">
                      Confidence: {activeClaim.confidenceScore}%
                    </span>
                  </div>
                  <h3 className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
                    Extracted from <strong className="text-neutral-700 dark:text-[#FFF4E3]">{activeClaim.sourceName}</strong>
                  </h3>
                </div>

                <div>{getStatusBadge(activeClaim.verificationStatus)}</div>
              </div>

              {/* Extracted Knowledge Assertion */}
              <div className="bg-[#FFF4E3]/60 dark:bg-[#14133B] border-2 border-[#E5B25D]/50 dark:border-[#55C7C2]/30 rounded-lg p-4 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#25245F]/70 dark:text-[#55C7C2] block">
                  Extracted Assertion Statement
                </span>
                <p className="text-sm font-bold text-[#25245F] dark:text-[#FFF4E3] leading-relaxed">
                  {activeClaim.statement}
                </p>
              </div>

              {/* Grounded Citation Quote */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-[#C4C3E0]">
                  <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-[#55C7C2]" />
                    Authoritative Document Excerpt
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500 dark:text-[#8E8DAF]">
                    {activeClaim.sourceLocation}
                  </span>
                </div>
                <div className="bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] rounded-lg p-4">
                  <blockquote className="pl-3 border-l-4 border-[#55C7C2] text-xs text-neutral-800 dark:text-[#C4C3E0] italic leading-relaxed">
                    "{activeClaim.sourceEvidenceQuote}"
                  </blockquote>
                </div>
              </div>

              {/* Reviewer Notes & Decision Rationale */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-[#FFF4E3] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
                  Reviewer Rationale & Handover Clarification Note
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Document your engineering signoff decision, which source takes precedence, or instructions for incoming engineers..."
                  className="w-full text-xs p-3 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] text-neutral-900 dark:text-[#FFF4E3] rounded-lg focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2]"
                  rows={3}
                />
              </div>

              {/* Action Bar */}
              <div className="pt-4 border-t-2 border-neutral-200 dark:border-[#2D2C68] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-neutral-500 dark:text-[#8E8DAF] font-mono">
                  Decisions record immediately to audit ledger.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDecision('rejected')}
                    className="px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800/50 rounded-lg shadow-[2px_2px_0px_rgba(225,29,72,0.15)] active:translate-x-[1px] active:translate-y-[1px] hover:bg-rose-100 transition-all cursor-pointer"
                  >
                    Reject Assertion
                  </button>

                  {onToggleFlagClaim && (
                    <button
                      onClick={() => {
                        onToggleFlagClaim(activeClaim.id);
                        const nextState = !activeClaim.isFlagged;
                        setFeedbackMessage({
                          text: nextState ? `Claim ${activeClaim.id} flagged for review.` : `Flag removed from claim ${activeClaim.id}.`,
                          type: 'warn',
                        });
                        setTimeout(() => setFeedbackMessage(null), 3500);
                      }}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border-2 shadow-[2px_2px_0px_rgba(217,119,6,0.15)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeClaim.isFlagged
                          ? 'text-amber-900 dark:text-amber-200 bg-amber-200 dark:bg-amber-900/70 border-amber-400 dark:border-amber-600 hover:bg-amber-300'
                          : 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/50 hover:bg-amber-100'
                      }`}
                      title={activeClaim.isFlagged ? 'Remove flag from this claim' : 'Flag this claim for review'}
                    >
                      <Flag className={`w-3.5 h-3.5 ${activeClaim.isFlagged ? 'fill-amber-600 text-amber-700 dark:fill-amber-400 dark:text-amber-300' : 'text-amber-600'}`} />
                      <span>{activeClaim.isFlagged ? 'Remove Flag' : 'Flag Claim'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDecision('verified')}
                    className="px-4 py-2 text-xs font-bold text-white dark:text-[#111033] bg-[#25245F] dark:bg-[#55C7C2] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] rounded-lg border-2 border-[#25245F] dark:border-[#55C7C2] shadow-[3px_3px_0px_#55C7C2] dark:shadow-[3px_3px_0px_#25245F] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-[#55C7C2] dark:text-[#111033]" />
                    <span>Verify & Approve Claim</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-7 bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm p-12 text-center text-xs text-neutral-500 dark:text-[#8E8DAF] transition-colors">
              Select a claim from the queue to inspect evidence and record a review decision.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
