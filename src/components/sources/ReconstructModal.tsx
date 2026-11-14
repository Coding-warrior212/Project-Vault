/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Source, KnowledgeClaim } from '../../types';
import {
  X,
  Sparkles,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Sliders,
  Quote,
  Eye,
} from 'lucide-react';
import { extractKnowledgeFromSource, ReconstructResult } from '../../services/reconstruct';
import { SourceType3DGlyph } from '../common/Soft3DVisuals';

interface ReconstructModalProps {
  source: Source | null;
  isOpen: boolean;
  onClose: () => void;
  onClaimsExtracted: (sourceId: string, claims: KnowledgeClaim[], updatedSource: Source) => void;
  onNavigateToLedger: (sourceId?: string) => void;
  onInspectClaim?: (claim: KnowledgeClaim) => void;
}

export const ReconstructModal: React.FC<ReconstructModalProps> = ({
  source,
  isOpen,
  onClose,
  onClaimsExtracted,
  onNavigateToLedger,
  onInspectClaim,
}) => {
  const [status, setStatus] = React.useState<
    'idle' | 'preparing' | 'sending' | 'analyzing' | 'validating' | 'persisting' | 'completed' | 'error'
  >('idle');
  const [progressPercent, setProgressPercent] = React.useState<number>(0);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [result, setResult] = React.useState<ReconstructResult | null>(null);
  const [isReprocessing, setIsReprocessing] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen && source) {
      // If source was already reconstructed, check if user is reprocessing
      setIsReprocessing(Boolean(source.reconstructStatus === 'completed' || (source.claimsCount && source.claimsCount > 0)));
      setStatus('idle');
      setProgressPercent(0);
      setStatusMessage('');
      setResult(null);
    }
  }, [isOpen, source?.id]);

  if (!isOpen || !source) return null;

  const handleStartExtraction = async () => {
    setStatus('preparing');
    setProgressPercent(10);
    setStatusMessage('Initiating knowledge reconstruction engine...');
    setResult(null);

    const res = await extractKnowledgeFromSource(source, (stage, message, progress) => {
      setStatus(stage);
      setStatusMessage(message);
      setProgressPercent(progress);
    });

    setResult(res);

    if (res.success) {
      const updatedSource: Source = {
        ...source,
        claimsCount: res.claims.length,
        reconstructStatus: 'completed',
        reconstructedAt: new Date().toISOString(),
        summary: res.summary || source.summary,
      };
      onClaimsExtracted(source.id, res.claims, updatedSource);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="bg-white dark:bg-[#1B1A48] border-2 border-neutral-300 dark:border-[#2D2C68] rounded-2xl w-full max-w-3xl overflow-hidden shadow-[8px_8px_0px_#25245F] dark:shadow-[8px_8px_0px_#55C7C2] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b-2 border-neutral-200 dark:border-[#2D2C68] flex items-center justify-between bg-neutral-50/70 dark:bg-[#14133B]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25245F] dark:bg-[#2D2B75] flex items-center justify-center text-[#55C7C2] shadow-[2px_2px_0px_#F36B3F] shrink-0">
              <Sparkles className="w-5 h-5 text-[#55C7C2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#25245F] text-white rounded">
                  Stage 2 · RECONSTRUCT
                </span>
                <span className="text-[10px] font-mono font-bold text-[#F36B3F] bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-900/40">
                  AI reconstruction (temporarily unavailable)
                </span>
              </div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-[#FFF4E3] mt-0.5">
                {isReprocessing ? 'Reprocess & Update Knowledge Claims' : 'Reconstruct Project Knowledge Claims'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-[#25245F] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Source Document Card */}
          <div className="p-4 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] rounded-xl flex items-start gap-4">
            <div className="shrink-0 pt-1">
              <SourceType3DGlyph type={source.type} size="md" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-neutral-900 dark:text-[#FFF4E3] text-sm truncate">
                  {source.title}
                </h3>
                <span className="font-mono text-[11px] text-neutral-500 dark:text-[#8E8DAF]">
                  {source.size}
                </span>
              </div>

              <div className="text-xs text-neutral-600 dark:text-[#C4C3E0] font-mono flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3 text-neutral-400" />
                  {source.filename}
                </span>
                {source.pages && source.pages.length > 0 && (
                  <span>· {source.pages.length} Pages</span>
                )}
                <span>· {(source.charCount || source.extractedText?.length || 0).toLocaleString()} characters extracted</span>
              </div>

              {source.summary && (
                <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] line-clamp-2 pt-1 border-t border-neutral-200 dark:border-[#2D2C68]/60 mt-1">
                  {source.summary}
                </p>
              )}
            </div>
          </div>

          {/* Reprocess Warning if previously processed */}
          {isReprocessing && status === 'idle' && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Controlled Source Reprocessing</p>
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  This document previously generated {source.claimsCount} claims. Re-running reconstruction will cleanly replace previous claims for this source with fresh, verified evidence assertions. No orphaned or duplicate records will be created.
                </p>
              </div>
            </div>
          )}

          {/* Untrusted Data & Security Disclaimer */}
          <div className="p-3.5 bg-[#FFF4E3]/60 dark:bg-[#25245F]/30 border border-[#E5B25D]/50 dark:border-[#55C7C2]/30 rounded-xl text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-[#25245F] dark:text-[#55C7C2] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[#25245F] dark:text-[#55C7C2] text-[11px] uppercase tracking-wider block">
                Evidence Traceability & Untrusted Data Safeguard
              </span>
              <p className="text-[11px] text-neutral-600 dark:text-[#C4C3E0] leading-relaxed">
                AI reconstruction is temporarily disabled while authenticated workspace authorization is being completed. This fail-closed safeguard prevents unauthenticated document submission and provider quota use. Existing claims remain available for human review; do not interpret sample claims as newly AI-verified evidence.
              </p>
            </div>
          </div>

          {/* Extraction Execution States */}
          {status === 'idle' && (
            <div className="p-8 text-center space-y-4 border-2 border-dashed border-neutral-300 dark:border-[#2D2C68] rounded-xl bg-neutral-50/50 dark:bg-[#14133B]/40">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#55C7C2]/20 text-[#25245F] dark:text-[#55C7C2] flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-bold text-neutral-900 dark:text-[#FFF4E3] text-sm">
                  AI Reconstruction Temporarily Paused
                </h4>
                <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] leading-relaxed">
                  This capability will return after ProjectVault can verify your sign-in and workspace permissions on the server. You can continue reviewing existing knowledge claims and source evidence.
                </p>
              </div>
              <button
                type="button"
                disabled
                title="Unavailable until authenticated workspace authorization is implemented"
                className="px-6 py-2.5 text-xs font-bold text-neutral-500 bg-neutral-200 dark:bg-[#25245F] rounded-lg border-2 border-neutral-300 dark:border-[#2D2C68] cursor-not-allowed inline-flex items-center gap-2 opacity-80"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Temporarily unavailable</span>
              </button>
            </div>
          )}

          {/* Active Processing State */}
          {status !== 'idle' && status !== 'completed' && status !== 'error' && (
            <div className="p-6 border-2 border-neutral-300 dark:border-[#2D2C68] rounded-xl bg-neutral-50 dark:bg-[#14133B] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full border-2 border-[#F36B3F] border-t-transparent animate-spin" />
                  <span className="font-bold text-neutral-900 dark:text-[#FFF4E3] text-xs">
                    AI reconstruction is currently disabled
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-[#F36B3F]">{progressPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-neutral-200 dark:bg-[#25245F] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F36B3F] transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#55C7C2] animate-pulse" />
                <span>{statusMessage}</span>
              </p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="p-5 bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-800 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="font-bold text-rose-900 dark:text-rose-200 text-xs">
                    Reconstruction Failed
                  </h4>
                  <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                    {result?.error || statusMessage || 'Could not complete knowledge extraction from this source.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200 dark:border-rose-900/60">
                <button
                  onClick={handleStartExtraction}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Extraction</span>
                </button>
              </div>
            </div>
          )}

          {/* Success State & Extracted Claims Preview */}
          {status === 'completed' && result && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800/60 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                      Reconstruction Succeeded
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Extracted {result.extractedCount} atomic claims ({result.groundedCount} directly anchored to verbatim citations). Stored in IndexedDB.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onNavigateToLedger(source.id);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#25245F] dark:bg-[#2D2B75] hover:bg-[#1E1D4E] rounded-lg border border-[#25245F] dark:border-[#55C7C2]/40 shadow-xs transition-all inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Open in Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Claims Preview List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF] px-1 font-semibold">
                  <span>Synthesized Claims ({result.claims.length})</span>
                  <span>Initial Status: Unverified</span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {result.claims.map((claim) => (
                    <div
                      key={claim.id}
                      onClick={() => onInspectClaim?.(claim)}
                      className="p-3.5 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-200 dark:border-[#2D2C68] rounded-xl hover:border-[#25245F] dark:hover:border-[#55C7C2] transition-colors cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-neutral-700 dark:text-[#C4C3E0]">
                            {claim.id}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-200/80 dark:bg-[#25245F] text-neutral-800 dark:text-[#FFF4E3]">
                            {claim.category}
                          </span>
                          {claim.pageNumber && (
                            <span className="text-[10px] font-mono text-neutral-500 dark:text-[#8E8DAF]">
                              Page {claim.pageNumber}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold font-mono text-neutral-700 dark:text-[#FFF4E3]">
                            {claim.confidenceScore}% conf
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                            Unverified
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-900 dark:text-[#FFF4E3] font-medium leading-relaxed group-hover:text-[#25245F] dark:group-hover:text-[#55C7C2] transition-colors">
                        {claim.statement}
                      </p>

                      <div className="p-2 bg-white dark:bg-[#1B1A48] rounded border border-neutral-200 dark:border-[#2D2C68] text-[11px] text-neutral-600 dark:text-[#C4C3E0] flex items-start gap-1.5 italic font-serif">
                        <Quote className="w-3 h-3 text-neutral-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">"{claim.sourceEvidenceQuote}"</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-neutral-200 dark:border-[#2D2C68] flex items-center justify-between bg-neutral-50/70 dark:bg-[#14133B]/60">
          <div className="text-xs text-neutral-500 dark:text-[#8E8DAF] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#55C7C2]" />
            <span>Workspace authorization required · AI paused</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-700 dark:text-[#FFF4E3] bg-neutral-100 dark:bg-[#25245F] hover:bg-neutral-200 dark:hover:bg-[#2D2B75] rounded-lg transition-colors cursor-pointer"
            >
              {status === 'completed' ? 'Done' : 'Cancel'}
            </button>
            {status === 'completed' && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToLedger(source.id);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#F36B3F] hover:bg-[#E0572C] rounded-lg border-2 border-[#F36B3F] shadow-[2px_2px_0px_#25245F] dark:shadow-[2px_2px_0px_#55C7C2] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>View in Knowledge Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
