import React from 'react';
import { KnowledgeClaim } from '../../types';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  GitBranch,
  User,
  Quote,
  Sparkles,
  Info,
  Flag,
} from 'lucide-react';

interface ClaimModalProps {
  claim: KnowledgeClaim | null;
  onClose: () => void;
  onUpdateStatus?: (claimId: string, newStatus: KnowledgeClaim['verificationStatus'], note?: string) => void;
  onNavigateToSource?: (sourceId: string) => void;
  onToggleFlag?: (claimId: string) => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  claim,
  onClose,
  onUpdateStatus,
  onNavigateToSource,
  onToggleFlag,
}) => {
  const [reviewNote, setReviewNote] = React.useState('');
  const [isEditingNote, setIsEditingNote] = React.useState(false);
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (claim) {
      setReviewNote(claim.humanReviewNotes || '');
      setIsEditingNote(false);
    }
  }, [claim]);

  if (!claim) return null;

  const handleAction = (status: KnowledgeClaim['verificationStatus']) => {
    if (onUpdateStatus) {
      onUpdateStatus(claim.id, status, reviewNote);
    }
    onClose();
  };

  const getStatusBadge = (status: KnowledgeClaim['verificationStatus']) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified & Approved
          </span>
        );
      case 'conflicted':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F36B3F] bg-orange-50 px-2.5 py-1 rounded-md border border-orange-200">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F36B3F]" />
            Direct Conflict Detected
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            Awaiting Human Verification
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected by Reviewer
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-[#25245F] dark:border-[#55C7C2]/50 shadow-[6px_6px_0px_#25245F] dark:shadow-[6px_6px_0px_rgba(85,199,194,0.3)] flex flex-col overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-200 dark:border-[#2D2C68] bg-[#25245F] dark:bg-[#15143C] text-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white font-mono text-xs font-bold border border-white/20">
              {claim.id.replace('CLM-', '')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/70">{claim.id}</span>
                <span className="text-white/40">·</span>
                <span className="text-xs font-medium text-white/90">{claim.category}</span>
                <span className="text-white/40">·</span>
                <span className="text-xs text-[#55C7C2] font-semibold">
                  {claim.confidenceScore}% Confidence
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mt-0.5">
                Knowledge Evidence Inspector
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Claim Statement Section */}
          <div className="bg-[#FFF4E3]/40 dark:bg-[#14133B] border border-[#FFF4E3] dark:border-[#2D2C68] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#25245F]/70 dark:text-[#55C7C2]">
                Extracted Knowledge Statement
              </span>
              <div className="flex items-center gap-2">
                {claim.isFlagged && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded border-2 border-amber-400 dark:border-amber-600 shadow-xs">
                    <Flag className="w-3 h-3 fill-amber-500 text-amber-600 dark:text-amber-400" />
                    FLAGGED
                  </span>
                )}
                {getStatusBadge(claim.verificationStatus)}
              </div>
            </div>
            <p className="text-base font-semibold text-[#25245F] dark:text-[#FFF4E3] leading-relaxed">
              {claim.statement}
            </p>
          </div>

          {/* Feedback Banner for Flag/Action Confirmation */}
          {feedbackMsg && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-lg flex items-center justify-between shadow-xs animate-in fade-in duration-150">
              <span className="flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                {feedbackMsg}
              </span>
              <button
                onClick={() => setFeedbackMsg(null)}
                className="text-amber-700 hover:text-amber-900 dark:hover:text-amber-100 text-xs ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* AI Reconstruction Rationale (if generated by Gemini) */}
          {claim.aiExplanation && (
            <div className="bg-purple-50/70 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800/40 rounded-lg p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                <Sparkles className="w-3.5 h-3.5 text-[#F36B3F]" />
                AI Reconstruction Rationale (Gemini 3.8 Flash)
              </div>
              <p className="text-xs text-purple-950 dark:text-purple-200 leading-relaxed">
                {claim.aiExplanation}
              </p>
            </div>
          )}

          {/* Confidence vs Factual Verification Principle */}
          <div className="bg-neutral-50 dark:bg-[#14133B] border border-neutral-200 dark:border-[#2D2C68] rounded-lg p-3 flex items-start gap-2.5 text-xs text-neutral-600 dark:text-[#C4C3E0]">
            <Info className="w-4 h-4 text-[#55C7C2] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-neutral-800 dark:text-[#FFF4E3] block">
                Confidence ({claim.confidenceScore}%) vs. Factual Verification
              </span>
              <p className="text-[11px] leading-relaxed">
                Extraction confidence reflects Gemini's certainty in verbatim document phrasing. All AI-synthesized claims are initially marked <strong>UNVERIFIED</strong> until confirmed by an engineering lead.
              </p>
            </div>
          </div>

          {/* Traceable Grounded Evidence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-[#C4C3E0]">
                <Quote className="w-3.5 h-3.5 text-[#55C7C2]" />
                Primary Source Evidence Citation
              </div>
              {onNavigateToSource && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToSource(claim.sourceId);
                  }}
                  className="text-xs text-[#25245F] dark:text-[#55C7C2] hover:text-[#F36B3F] font-medium flex items-center gap-1 transition-colors"
                >
                  <span>Open Source</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="bg-neutral-50 dark:bg-[#14133B] rounded-lg border border-neutral-200 dark:border-[#2D2C68] p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-[#C4C3E0] pb-2 border-b border-neutral-200 dark:border-[#2D2C68]">
                <span className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-neutral-500 dark:text-[#8E8DAF]" />
                  {claim.sourceName}
                </span>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <span className="font-mono text-neutral-600 dark:text-[#C4C3E0]">{claim.sourceLocation}</span>
              </div>

              <blockquote className="pl-3 border-l-2 border-[#55C7C2] text-sm text-neutral-800 dark:text-[#C4C3E0] italic leading-relaxed bg-white/60 dark:bg-[#1B1A48] p-2.5 rounded-r">
                "{claim.sourceEvidenceQuote}"
              </blockquote>

              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF] pt-1">
                <span>Provenance: Extracted and grounded via source document parse</span>
                <span className="font-mono text-neutral-700 dark:text-[#FFF4E3] font-medium">Confidence: {claim.confidenceScore}%</span>
              </div>
            </div>
          </div>

          {/* Contradiction / Conflict Section if any */}
          {claim.conflictingEvidence && (
            <div className="bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F36B3F]">
                <AlertTriangle className="w-4 h-4" />
                Detected Contradiction with Alternate Source
              </div>

              <p className="text-xs text-orange-950 dark:text-orange-200 font-medium">
                {claim.conflictingEvidence.conflictReason}
              </p>

              <div className="bg-white dark:bg-[#14133B] rounded-md border border-orange-200 dark:border-orange-900/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-[#C4C3E0]">
                  <span className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-[#F36B3F]" />
                    {claim.conflictingEvidence.sourceName}
                  </span>
                  <span className="font-mono text-neutral-500 dark:text-[#8E8DAF]">{claim.conflictingEvidence.sourceLocation}</span>
                </div>
                <blockquote className="text-xs text-neutral-800 dark:text-[#C4C3E0] pl-2.5 border-l-2 border-[#F36B3F] italic">
                  "{claim.conflictingEvidence.conflictingStatement}"
                </blockquote>
              </div>
            </div>
          )}

          {/* Reviewer Audit Trail & Notes */}
          <div className="border border-neutral-200 dark:border-[#2D2C68] rounded-lg p-4 bg-neutral-50/50 dark:bg-[#14133B]/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-[#C4C3E0]">
                <User className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
                Human Review & Audit Notes
              </div>
              {claim.lastReviewedBy && (
                <span className="text-xs text-neutral-500 dark:text-[#8E8DAF] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Reviewed by {claim.lastReviewedBy} ({claim.lastReviewedAt})
                </span>
              )}
            </div>

            {isEditingNote ? (
              <div className="space-y-2">
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Record rationale, clarification, or authoritative decision for this knowledge claim..."
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#1B1A48] border border-neutral-300 dark:border-[#35337C] text-neutral-900 dark:text-[#FFF4E3] placeholder-neutral-400 dark:placeholder-[#8E8DAF] rounded-md focus:outline-none focus:ring-1 focus:ring-[#25245F] dark:focus:ring-[#55C7C2]"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingNote(false)}
                    className="px-2.5 py-1 text-xs text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsEditingNote(false)}
                    className="px-3 py-1 text-xs bg-[#25245F] dark:bg-[#55C7C2] text-white dark:text-[#111033] font-medium rounded-md hover:bg-[#1B1A48] dark:hover:bg-[#46aba6]"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsEditingNote(true)}
                className="text-xs text-neutral-700 dark:text-[#C4C3E0] bg-white dark:bg-[#1B1A48] p-3 rounded-md border border-neutral-200 dark:border-[#2D2C68] cursor-pointer hover:border-neutral-300 dark:hover:border-[#35337C] transition-colors"
              >
                {reviewNote ? (
                  <p>{reviewNote}</p>
                ) : (
                  <span className="text-neutral-400 dark:text-[#8E8DAF] italic">
                    Click to attach a reviewer note or decision rationale...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-50 dark:bg-[#14133B] border-t-2 border-neutral-200 dark:border-[#2D2C68]">
          <div className="text-xs text-neutral-500 dark:text-[#8E8DAF]">
            Principle: <span className="font-bold text-neutral-700 dark:text-[#C4C3E0]">Humans make final approval decisions.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('rejected')}
              className="px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800/50 rounded-lg shadow-[2px_2px_0px_rgba(225,29,72,0.15)] active:translate-x-[1px] active:translate-y-[1px] hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer whitespace-nowrap"
            >
              Reject Claim
            </button>

            {onToggleFlag && (
              <button
                onClick={() => {
                  onToggleFlag(claim.id);
                  const nextState = !claim.isFlagged;
                  setFeedbackMsg(nextState ? 'Claim flagged for review.' : 'Flag removed from claim.');
                  setTimeout(() => setFeedbackMsg(null), 3500);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 shadow-[2px_2px_0px_rgba(217,119,6,0.15)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  claim.isFlagged
                    ? 'text-amber-900 dark:text-amber-200 bg-amber-200 dark:bg-amber-900/70 border-amber-400 dark:border-amber-600 hover:bg-amber-300'
                    : 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                }`}
                title={claim.isFlagged ? 'Remove flag from this claim' : 'Flag this claim for review'}
              >
                <Flag className={`w-3.5 h-3.5 ${claim.isFlagged ? 'fill-amber-600 text-amber-700 dark:fill-amber-400 dark:text-amber-300' : 'text-amber-600'}`} />
                <span>{claim.isFlagged ? 'Remove Flag' : 'Flag Claim'}</span>
              </button>
            )}

            <button
              onClick={() => handleAction('verified')}
              className="px-4 py-1.5 text-xs font-bold text-white dark:text-[#111033] bg-[#25245F] dark:bg-[#55C7C2] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] rounded-lg border-2 border-[#25245F] dark:border-[#55C7C2] shadow-[3px_3px_0px_#55C7C2] dark:shadow-[3px_3px_0px_#25245F] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#55C7C2] dark:text-[#111033]" />
              Approve & Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
