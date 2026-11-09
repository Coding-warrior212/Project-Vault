/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  KnowledgeClaim,
  Source,
  Workspace,
  ProjectConflict,
  MissingInfoFinding,
  UnresolvedQuestion,
} from '../../types';
import { HANDOVER_TEMPLATE } from '../../data/sampleData';
import {
  FileCheck2,
  Download,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Printer,
  Sparkles,
  FileText,
  Share2,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Flag,
  XCircle,
  Lock,
  Unlock,
  User,
  MessageSquare,
  SquareCheckBig,
  Square,
} from 'lucide-react';
import { HandoverDossier3D } from '../common/Soft3DVisuals';

interface HandoverPageProps {
  currentWorkspace: Workspace;
  claims: KnowledgeClaim[];
  sources: Source[];
  conflicts: ProjectConflict[];
  missingInfo: MissingInfoFinding[];
  questions: UnresolvedQuestion[];
  onNavigateToReview: () => void;
  onNavigateToLedger: () => void;
}

export const HandoverPage: React.FC<HandoverPageProps> = ({
  currentWorkspace,
  claims,
  sources,
  conflicts,
  missingInfo,
  questions,
  onNavigateToReview,
  onNavigateToLedger,
}) => {
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<'markdown' | 'executive'>('markdown');

  // Reviewer notes & signoff state persisted in localStorage
  const [executiveNote, setExecutiveNote] = React.useState<string>(() => {
    return localStorage.getItem('projectvault_handover_exec_note') || HANDOVER_TEMPLATE.summary;
  });
  const [approverName, setApproverName] = React.useState<string>(() => {
    return localStorage.getItem('projectvault_handover_approver') || '';
  });
  const [finalComment, setFinalComment] = React.useState<string>(() => {
    return localStorage.getItem('projectvault_handover_comment') || '';
  });

  // Approval checklist state
  const [checklist, setChecklist] = React.useState({
    verified: false,
    unverified: false,
    conflicts: false,
    missing: false,
    evidence: false,
  });

  const [isApproved, setIsApproved] = React.useState<boolean>(() => {
    return localStorage.getItem('projectvault_handover_approved') === 'true';
  });

  // Handle changes that invalidate prior approval
  const handleNoteChange = (setter: React.Dispatch<React.SetStateAction<string>>, storageKey: string, val: string) => {
    setter(val);
    localStorage.setItem(storageKey, val);
    setIsApproved(false);
    localStorage.setItem('projectvault_handover_approved', 'false');
  };

  const handleChecklistToggle = (key: keyof typeof checklist) => {
    setChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
    setIsApproved(false);
    localStorage.setItem('projectvault_handover_approved', 'false');
  };

  const allChecklistItemsChecked = Object.values(checklist).every(Boolean);

  const handleApproveHandover = () => {
    if (!allChecklistItemsChecked) return;
    setIsApproved(true);
    localStorage.setItem('projectvault_handover_approved', 'true');
  };

  // Filtered categories
  const verifiedClaims = claims.filter((c) => c.verificationStatus === 'verified');
  const unverifiedClaims = claims.filter((c) => c.verificationStatus === 'unverified');
  const rejectedClaims = claims.filter((c) => c.verificationStatus === 'rejected');
  const flaggedClaims = claims.filter((c) => c.isFlagged === true);
  const conflictedClaims = claims.filter((c) => c.verificationStatus === 'conflicted');
  const openConflicts = conflicts.filter((c) => c.status === 'open');
  const openMissingInfo = missingInfo.filter((m) => m.status === 'open');
  const openQuestions = questions.filter((q) => q.status === 'open');

  const verificationPercentage = claims.length > 0 ? Math.round((verifiedClaims.length / claims.length) * 100) : 0;

  // Generate Markdown Handover Content
  const generatedMarkdown = `# ${HANDOVER_TEMPLATE.title}
Workspace: ${currentWorkspace.name} (${currentWorkspace.code})
Version: ${HANDOVER_TEMPLATE.version}
Author/Lead Reviewer: ${approverName || 'ProjectVault AI Continuity Engine'}
Approval Status: ${isApproved ? 'APPROVED & SIGNED OFF' : 'PENDING HUMAN APPROVAL'}
Integrity Status: ${verificationPercentage}% Verified (${verifiedClaims.length}/${claims.length} claims)
Generated At: ${new Date().toLocaleString()}

---

## 1. Executive Summary & Reviewer Notes
${executiveNote}

${finalComment ? `**Final Reviewer Comment:**\n> ${finalComment}\n` : ''}

---

## 2. Handover Readiness & Metric Breakdown
- **Verified Claims (Approved):** ${verifiedClaims.length}
- **Unverified Claims (Pending):** ${unverifiedClaims.length}
- **Flagged Claims:** ${flaggedClaims.length}
- **Rejected Claims:** ${rejectedClaims.length}
- **Conflicted Claims:** ${conflictedClaims.length}
- **Open Conflicts:** ${openConflicts.length}
- **Missing Information Findings:** ${openMissingInfo.length}
- **Unresolved Questions:** ${openQuestions.length}
- **Connected Supporting Sources:** ${sources.length}

---

## 3. Verified Knowledge & Decisions
${
  verifiedClaims.length > 0
    ? verifiedClaims
        .map(
          (c) =>
            `### [VERIFIED] ${c.id} (${c.category} · ${c.confidenceScore}% confidence)
- **Statement:** ${c.statement}
- **Source Reference:** ${c.sourceName} (${c.sourceLocation})
- **Evidence Quote:** "${c.sourceEvidenceQuote}"
- **Rationale:** ${c.aiExplanation || 'N/A'}\n`
        )
        .join('\n')
    : '_No verified claims signed off yet._'
}

---

## 4. Unverified & Flagged Information (Requires Review)
${
  [...unverifiedClaims, ...flaggedClaims].length > 0
    ? Array.from(new Set([...unverifiedClaims, ...flaggedClaims]))
        .map(
          (c) =>
            `### [${c.isFlagged ? 'FLAGGED' : 'UNVERIFIED'}] ${c.id} (${c.category})
- **Statement:** ${c.statement}
- **Source Reference:** ${c.sourceName} (${c.sourceLocation})
- **Evidence Quote:** "${c.sourceEvidenceQuote}"
${c.flagReason ? `- **Flag Reason:** ${c.flagReason}` : ''}\n`
        )
        .join('\n')
    : '_No unverified or flagged items pending._'
}

---

## 5. Rejected Information
${
  rejectedClaims.length > 0
    ? rejectedClaims
        .map(
          (c) =>
            `### [REJECTED] ${c.id} (${c.category})
- **Statement:** ${c.statement}
- **Source Reference:** ${c.sourceName} (${c.sourceLocation})
- **Evidence Quote:** "${c.sourceEvidenceQuote}"
- **Rejection Note:** ${c.humanReviewNotes || 'Marked as rejected by reviewer'}\n`
        )
        .join('\n')
    : '_No rejected claims._'
}

---

## 6. Unresolved Conflicts & Risks
${
  conflicts.length > 0
    ? conflicts
        .map(
          (con) =>
            `### [CONFLICT - ${con.severity}] ${con.title} (${con.status.toUpperCase()})
- **Description:** ${con.description}
- **Supporting Evidence:**
  1. "${con.supportingEvidence[0] || ''}" — ${con.sourceReferences[0] || ''}
  2. "${con.supportingEvidence[1] || ''}" — ${con.sourceReferences[1] || ''}
- **Resolution Status:** ${con.status}
${con.resolvedNote ? `- **Resolution Note:** ${con.resolvedNote}` : ''}\n`
        )
        .join('\n')
    : '_No active conflicts recorded._'
}

---

## 7. Missing Information Findings
${
  missingInfo.length > 0
    ? missingInfo
        .map(
          (m) =>
            `### [MISSING INFO - ${m.severity.toUpperCase()}] ${m.title} (${m.status.toUpperCase()})
- **Description:** ${m.description}
- **Why It Matters:** ${m.whyItMatters}
${m.actionSuggestion ? `- **Action Suggestion:** ${m.actionSuggestion}` : ''}\n`
        )
        .join('\n')
    : '_No missing information findings recorded._'
}

---

## 8. Unresolved Questions
${
  questions.length > 0
    ? questions
        .map(
          (q) =>
            `### [QUESTION - ${q.status.toUpperCase()}] ${q.question} (${q.status.toUpperCase()})
- **Context:** ${q.context}
${q.answer ? `- **Answer/Resolution:** ${q.answer}` : ''}\n`
        )
        .join('\n')
    : '_No unresolved questions recorded._'
}

---

## 9. Connected Sources & Repositories
${
  sources.length > 0
    ? sources
        .map(
          (s) =>
            `- **${s.title}** (${s.filename} · ${s.type.toUpperCase()} · ${s.size} · ${
              s.isUserUploaded ? 'User Uploaded [IndexedDB]' : 'Synthetic Demo [Sample]'
            }): Ingested ${s.ingestedAt}${
              s.charCount ? ` · ${s.charCount.toLocaleString()} chars` : ''
            }${s.contentHash ? ` · SHA-256: \`${s.contentHash.slice(0, 16)}...\`` : ''}.`
        )
        .join('\n')
    : '_No sources connected._'
}

---
*End of ProjectVault Handover Dossier. Approved by: ${approverName || 'Pending Signoff'} (${isApproved ? 'Verified' : 'Unapproved'})*
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Stage 5 Indicator & HandoverDossier3D Visual */}
      <div className="bg-[#25245F] text-white rounded-xl p-6 border-2 border-[#1B1A48] dark:border-[#55C7C2]/40 shadow-[4px_4px_0px_#55C7C2] flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 bg-[#55C7C2] text-[#25245F] rounded border border-[#55C7C2]">
              Stage 5 / 5 · HANDOVER
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-white/10 text-white/90 rounded border border-white/20 font-semibold">
              {currentWorkspace.code} · {currentWorkspace.name}
            </span>
            <span className="text-white/40">·</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              isApproved ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              {isApproved ? '✓ HANDOVER APPROVED' : '⚠ APPROVAL PENDING'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">
            Project Handover & Continuity Package
          </h2>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            ProjectVault compiles verified technical decisions, architectural invariants, operational parameters, and unresolved risks into an audit-ready handover brief. Knowledge that stays, projects that move.
          </p>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => {
                if (isApproved) {
                  setShowExportModal(true);
                } else {
                  alert('Please complete the Pre-Export Approval Checklist below before generating the handover package.');
                }
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-lg border-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isApproved
                  ? 'text-white bg-[#F36B3F] hover:bg-[#E0572C] border-[#F36B3F] shadow-[3px_3px_0px_#FFF4E3] dark:shadow-[3px_3px_0px_#25245F]'
                  : 'text-neutral-300 bg-neutral-700/50 border-neutral-600 cursor-not-allowed opacity-70'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Generate & Export Handover Package</span>
            </button>
            {!isApproved && (
              <span className="text-[11px] text-amber-300/90 italic">
                (Complete checklist & sign off below to unlock export)
              </span>
            )}
          </div>
        </div>

        {/* Tactile 3D Sealed Dossier Motif */}
        <div className="hidden sm:flex items-center justify-center shrink-0">
          <HandoverDossier3D size="lg" />
        </div>
      </div>

      {/* Expanded Readiness Scorecard */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3]">
              Handover Readiness & Metric Breakdown
            </h3>
            <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
              Comprehensive audit breakdown of all workspace knowledge claims, conflicts, and findings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-md border-2 border-emerald-300 dark:border-emerald-700/60 shadow-[2px_2px_0px_rgba(16,185,129,0.15)]">
              {verificationPercentage}% Verified Grounding
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] text-xs">
            <span className="text-neutral-500 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Verified Claims</span>
            <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
              {verifiedClaims.length}
            </span>
            <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Signed off</span>
          </div>

          <div 
            onClick={onNavigateToLedger}
            className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] text-xs cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#25245F]/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Unverified</span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400 dark:text-[#8E8DAF]" />
            </div>
            <span className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums">
              {unverifiedClaims.length}
            </span>
            <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Pending review</span>
          </div>

          <div 
            onClick={onNavigateToLedger}
            className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] text-xs cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#25245F]/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-rose-600 dark:text-rose-400 block text-[10px] uppercase font-bold">Rejected</span>
              <ExternalLink className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <span className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400 tabular-nums">
              {rejectedClaims.length}
            </span>
            <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Discarded claims</span>
          </div>

          <div 
            onClick={onNavigateToLedger}
            className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border-2 border-amber-200 dark:border-amber-900/40 text-xs cursor-pointer hover:bg-amber-100/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-amber-700 dark:text-amber-400 block text-[10px] uppercase font-bold">Flagged</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums">
              {flaggedClaims.length}
            </span>
            <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Requires attention</span>
          </div>

          <div 
            onClick={onNavigateToReview}
            className="p-3 bg-orange-50/70 dark:bg-orange-950/20 rounded-lg border-2 border-orange-200 dark:border-orange-900/40 text-xs cursor-pointer hover:bg-orange-100/60 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[#F36B3F] block text-[10px] uppercase font-bold">Open Conflicts</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#F36B3F]" />
            </div>
            <span className="text-xl font-bold font-mono text-[#F36B3F] tabular-nums">
              {openConflicts.length}
            </span>
            <span className="text-neutral-500 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Contradictions</span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] text-xs">
            <span className="text-neutral-500 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Missing Info</span>
            <span className="text-xl font-bold font-mono text-[#25245F] dark:text-[#55C7C2] tabular-nums">
              {openMissingInfo.length}
            </span>
            <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Gaps identified</span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] text-xs">
            <span className="text-neutral-500 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Questions</span>
            <span className="text-xl font-bold font-mono text-[#25245F] dark:text-[#55C7C2] tabular-nums">
              {openQuestions.length}
            </span>
            <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Open items</span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] text-xs">
            <span className="text-neutral-500 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Sources</span>
            <span className="text-xl font-bold font-mono text-[#25245F] dark:text-[#55C7C2] tabular-nums">
              {sources.length}
            </span>
            <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[9px] mt-0.5">Connected docs</span>
          </div>
        </div>
      </div>

      {/* Reviewer Notes & Sign-Off Editor */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm transition-colors space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#F36B3F]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3]">
              Reviewer Notes & Executive Summary Sign-Off
            </h3>
          </div>
          <span className="text-[10px] font-mono text-neutral-400 dark:text-[#8E8DAF]">
            Persisted locally · Survives refresh
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 dark:text-[#FFF4E3] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#55C7C2]" />
              <span>Lead Reviewer / Approver Name</span>
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => handleNoteChange(setApproverName, 'projectvault_handover_approver', e.target.value)}
              placeholder="e.g. Alex Vance, Principal Architect"
              className="w-full px-3 py-2 text-xs rounded-lg border-2 border-neutral-300 dark:border-[#2D2C68] bg-neutral-50 dark:bg-[#14133B] text-neutral-900 dark:text-[#FFF4E3] focus:outline-hidden focus:border-[#55C7C2]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 dark:text-[#FFF4E3] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#55C7C2]" />
              <span>Final Handover Comment</span>
            </label>
            <input
              type="text"
              value={finalComment}
              onChange={(e) => handleNoteChange(setFinalComment, 'projectvault_handover_comment', e.target.value)}
              placeholder="e.g. Ready for staging deployment post-signoff."
              className="w-full px-3 py-2 text-xs rounded-lg border-2 border-neutral-300 dark:border-[#2D2C68] bg-neutral-50 dark:bg-[#14133B] text-neutral-900 dark:text-[#FFF4E3] focus:outline-hidden focus:border-[#55C7C2]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-neutral-700 dark:text-[#FFF4E3]">
            Executive Summary & Mission Context (Editable)
          </label>
          <textarea
            rows={3}
            value={executiveNote}
            onChange={(e) => handleNoteChange(setExecutiveNote, 'projectvault_handover_exec_note', e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border-2 border-neutral-300 dark:border-[#2D2C68] bg-neutral-50 dark:bg-[#14133B] text-neutral-900 dark:text-[#FFF4E3] focus:outline-hidden focus:border-[#55C7C2] leading-relaxed"
          />
        </div>
      </div>

      {/* Pre-Export Human Approval Checklist */}
      <div className={`rounded-xl p-5 border-2 neo-box-sm transition-colors space-y-4 ${
        isApproved
          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
          : 'bg-white dark:bg-[#1B1A48] border-amber-300 dark:border-amber-900/50'
      }`}>
        <div className="flex items-center justify-between pb-3 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isApproved ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              {isApproved ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3]">
                Pre-Export Human Approval Checklist
              </h3>
              <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
                Required sign-off before handover package can be marked approved and exported.
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-md border-2 ${
            isApproved 
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400'
              : 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
          }`}>
            {isApproved ? 'Handover Package Approved' : 'Approval Incomplete'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {[
            { key: 'verified' as const, label: 'Verified knowledge & decisions have been reviewed and signed off.' },
            { key: 'unverified' as const, label: 'Unverified and flagged items are clearly isolated and identified.' },
            { key: 'conflicts' as const, label: 'Active contradictions and unresolved architectural risks are disclosed.' },
            { key: 'missing' as const, label: 'Missing information findings and unresolved questions are included.' },
            { key: 'evidence' as const, label: 'Source evidence quotes, file names, and references are preserved intact.' },
          ].map((item) => (
            <div
              key={item.key}
              onClick={() => handleChecklistToggle(item.key)}
              className="p-3 rounded-lg bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] flex items-center gap-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#25245F]/40 transition-colors"
            >
              <div className="text-[#F36B3F] shrink-0">
                {checklist[item.key] ? (
                  <SquareCheckBig className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-400 dark:text-[#8E8DAF]" />
                )}
              </div>
              <span className={`text-neutral-800 dark:text-[#C4C3E0] select-none ${checklist[item.key] ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-between gap-4">
          <p className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] italic">
            Note: Any edits to reviewer notes or executive summaries will invalidate approval and require re-verification.
          </p>
          <button
            onClick={handleApproveHandover}
            disabled={!allChecklistItemsChecked || isApproved}
            className={`px-4 py-2 text-xs font-bold rounded-lg border-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              isApproved
                ? 'bg-emerald-600 text-white border-emerald-600 opacity-90 cursor-default'
                : allChecklistItemsChecked
                ? 'bg-[#F36B3F] hover:bg-[#E0572C] text-white border-[#F36B3F] shadow-[2px_2px_0px_#25245F]'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 border-neutral-300 dark:border-neutral-700 cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isApproved ? 'Handover Package Signed Off' : 'Approve Handover Package'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Handover Dossier Preview Sections */}
      <div className="space-y-4">
        {/* Section B: Verified Knowledge */}
        <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Verified Knowledge & Decisions ({verifiedClaims.length})
            </span>
            <span className="text-xs font-mono font-normal text-neutral-500 dark:text-[#8E8DAF]">
              Grounding Signed Off
            </span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
            Core architectural and technical decisions approved by lead reviewers.
          </p>

          <div className="space-y-2.5 pt-1">
            {verifiedClaims.length > 0 ? (
              verifiedClaims.map((c) => (
                <div key={c.id} className="p-3.5 rounded-lg bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{c.id} · {c.category}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      {c.confidenceScore}% Confidence
                    </span>
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">{c.statement}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-[#8E8DAF] pt-1 border-t border-neutral-200/60 dark:border-[#2D2C68]">
                    <span>Source: <strong className="text-neutral-700 dark:text-[#C4C3E0]">{c.sourceName}</strong> ({c.sourceLocation})</span>
                    <span className="font-mono italic">"{c.sourceEvidenceQuote}"</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-400 italic py-2">No verified claims found in workspace.</p>
            )}
          </div>
        </div>

        {/* Section C: Unverified & Flagged */}
        <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Unverified & Flagged Claims ({unverifiedClaims.length + flaggedClaims.length})
            </span>
            <span className="text-xs font-mono font-normal text-amber-600 dark:text-amber-400">
              Action Required
            </span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
            Claims awaiting review or explicitly flagged for human verification.
          </p>

          <div className="space-y-2.5 pt-1">
            {[...unverifiedClaims, ...flaggedClaims].length > 0 ? (
              Array.from(new Set([...unverifiedClaims, ...flaggedClaims])).map((c) => (
                <div key={c.id} className="p-3.5 rounded-lg bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{c.id} · {c.category}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${c.isFlagged ? 'bg-amber-100 text-amber-800' : 'bg-neutral-200 text-neutral-700'}`}>
                      {c.isFlagged ? 'FLAGGED' : 'UNVERIFIED'}
                    </span>
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">{c.statement}</p>
                  {c.flagReason && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Flag Reason: {c.flagReason}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-[#8E8DAF] pt-1 border-t border-neutral-200/60 dark:border-[#2D2C68]">
                    <span>Source: <strong className="text-neutral-700 dark:text-[#C4C3E0]">{c.sourceName}</strong> ({c.sourceLocation})</span>
                    <span className="font-mono italic">"{c.sourceEvidenceQuote}"</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-400 italic py-2">No unverified or flagged claims.</p>
            )}
          </div>
        </div>

        {/* Section D: Rejected Information */}
        {rejectedClaims.length > 0 && (
          <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Rejected Claims ({rejectedClaims.length})
              </span>
              <span className="text-xs font-mono font-normal text-rose-600 dark:text-rose-400">
                Discarded
              </span>
            </h3>

            <div className="space-y-2.5 pt-1">
              {rejectedClaims.map((c) => (
                <div key={c.id} className="p-3.5 rounded-lg bg-rose-50/40 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/40 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{c.id} · {c.category}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800">REJECTED</span>
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">{c.statement}</p>
                  {c.humanReviewNotes && (
                    <p className="text-xs text-rose-700 dark:text-rose-300">Rejection Note: {c.humanReviewNotes}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-[#8E8DAF] pt-1 border-t border-rose-200/60 dark:border-rose-900/30">
                    <span>Source: <strong className="text-neutral-700 dark:text-[#C4C3E0]">{c.sourceName}</strong> ({c.sourceLocation})</span>
                    <span className="font-mono italic">"{c.sourceEvidenceQuote}"</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section E: Conflicts & Unresolved Risks */}
        <div className="bg-orange-50/40 dark:bg-orange-950/20 rounded-xl p-5 border-2 border-orange-300 dark:border-orange-900/50 neo-box-sm space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F36B3F]" />
              Conflicts & Contradictions ({conflicts.length})
            </span>
            <span className="text-xs font-mono font-bold text-[#F36B3F] bg-white dark:bg-[#1B1A48] px-2.5 py-0.5 rounded border border-orange-200">
              ATTENTION REQUIRED
            </span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
            Direct contradictions detected across distinct source documents requiring lead architect signoff.
          </p>

          <div className="space-y-2.5 pt-1">
            {conflicts.length > 0 ? (
              conflicts.map((con) => (
                <div key={con.id} className="p-3.5 rounded-lg bg-white dark:bg-[#14133B] border-2 border-orange-200 dark:border-orange-900/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 dark:text-[#FFF4E3]">{con.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">{con.severity} SEVERITY</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                        con.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-800'
                      }`}>{con.status}</span>
                    </div>
                  </div>
                  <p className="text-neutral-600 dark:text-[#C4C3E0]">{con.description}</p>
                  <div className="space-y-1 pt-1 border-t border-neutral-200/60 dark:border-[#2D2C68]">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Supporting Evidence:</span>
                    {con.supportingEvidence.map((ev, i) => (
                      <div key={i} className="text-[11px] text-neutral-600 dark:text-[#C4C3E0] font-mono pl-2 border-l-2 border-[#F36B3F]">
                        "{ev}" — <span className="text-neutral-400">{con.sourceReferences[i]}</span>
                      </div>
                    ))}
                  </div>
                  {con.resolvedNote && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold pt-1">Resolution Note: {con.resolvedNote}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-400 italic py-2">No active conflicts recorded.</p>
            )}
          </div>
        </div>

        {/* Section F & G: Missing Information & Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#55C7C2]" />
                Missing Information ({missingInfo.length})
              </span>
            </h3>
            <div className="space-y-2 pt-1">
              {missingInfo.length > 0 ? (
                missingInfo.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900 dark:text-[#FFF4E3]">{m.title}</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">{m.status}</span>
                    </div>
                    <p className="text-neutral-600 dark:text-[#C4C3E0]">{m.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-400 italic">No missing information findings.</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#55C7C2]" />
                Unresolved Questions ({questions.length})
              </span>
            </h3>
            <div className="space-y-2 pt-1">
              {questions.length > 0 ? (
                questions.map((q) => (
                  <div key={q.id} className="p-3 rounded-lg bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900 dark:text-[#FFF4E3]">{q.question}</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">{q.status}</span>
                    </div>
                    <p className="text-neutral-600 dark:text-[#C4C3E0]">{q.context}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-400 italic">No unresolved questions.</p>
              )}
            </div>
          </div>
        </div>

        {/* Section H: Connected Sources */}
        <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#55C7C2]" />
            Connected Supporting Sources ({sources.length})
          </h3>
          <div className="space-y-2 pt-1">
            {sources.length > 0 ? (
              sources.map((s) => (
                <div key={s.id} className="p-3 rounded-lg bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-neutral-900 dark:text-[#FFF4E3]">{s.title || s.filename}</span>
                    <p className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] font-mono">
                      {s.type.toUpperCase()} · {s.size} · Ingested {s.ingestedAt}
                    </p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    s.isUserUploaded ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {s.isUserUploaded ? 'IndexedDB Upload' : 'Sample Demo'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-400 italic">No sources connected.</p>
            )}
          </div>
        </div>
      </div>

      {/* Generate Handover Package Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#1B1A48] rounded-xl shadow-2xl border border-neutral-200 dark:border-[#2D2C68] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-[#2D2C68] bg-[#25245F] dark:bg-[#15143C] text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/10 text-white">
                  <FileCheck2 className="w-5 h-5 text-[#55C7C2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Generated Handover Package (Approved Dossier)
                  </h3>
                  <p className="text-xs text-white/70">
                    {currentWorkspace.name} · Approved by {approverName || 'Lead Reviewer'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Rendered Markdown Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-neutral-900 dark:bg-[#0E0D24] text-neutral-100 font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre-wrap selection:bg-[#F36B3F]/40 selection:text-white">
                {generatedMarkdown}
              </pre>
            </div>

            {/* Modal Footer with Real Copy & Download */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-50 dark:bg-[#14133B] border-t border-neutral-200 dark:border-[#2D2C68] text-xs">
              <span className="text-neutral-500 dark:text-[#8E8DAF]">
                Ready for ingestion by Git repo, Notion, or internal engineering wiki.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-800 dark:text-[#FFF4E3] bg-white dark:bg-[#25245F] hover:bg-neutral-100 dark:hover:bg-[#2D2B75] border border-neutral-300 dark:border-[#35337C] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-600 dark:text-[#8E8DAF]" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([generatedMarkdown], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `projectvault-handover-${currentWorkspace.code.toLowerCase()}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#25245F] dark:bg-[#55C7C2] dark:text-[#111033] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#55C7C2] dark:text-[#111033]" />
                  <span>Download .md File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
