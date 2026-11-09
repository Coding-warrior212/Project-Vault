/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Source, KnowledgeClaim } from '../../types';
import {
  X,
  FileText,
  FileCode,
  Github,
  File,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Tag,
  ArrowRight,
  BookOpen,
  Copy,
  Check,
  Download,
  Trash2,
  Hash,
  Layers,
  AlertCircle,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { SourceType3DGlyph } from '../common/Soft3DVisuals';
import { getStoredFile } from '../../services/db';

interface SourceDetailModalProps {
  source: Source | null;
  claims: KnowledgeClaim[];
  onClose: () => void;
  onInspectClaim: (claim: KnowledgeClaim) => void;
  onNavigateToLedger: () => void;
  onDeleteSource?: (sourceId: string) => void;
  onReconstructSource?: (source: Source) => void;
}

export const SourceDetailModal: React.FC<SourceDetailModalProps> = ({
  source,
  claims,
  onClose,
  onInspectClaim,
  onNavigateToLedger,
  onDeleteSource,
  onReconstructSource,
}) => {
  const [activeTab, setActiveTab] = React.useState<'extracted' | 'pages' | 'excerpt' | 'claims'>('extracted');
  const [selectedPageNum, setSelectedPageNum] = React.useState<number>(1);
  const [copiedText, setCopiedText] = React.useState(false);
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [searchInDoc, setSearchInDoc] = React.useState('');

  React.useEffect(() => {
    if (source) {
      setActiveTab(source.extractedText ? 'extracted' : 'excerpt');
      setSelectedPageNum(1);
      setIsDeleting(false);
      setSearchInDoc('');
    }
  }, [source?.id]);

  if (!source) return null;

  const sourceClaims = claims.filter((c) => c.sourceId === source.id);
  const isPdfWithPages = source.type === 'pdf' && source.pages && source.pages.length > 0;
  const isUserUploaded = Boolean(source.isUserUploaded);
  const displayText = source.extractedText || source.rawExcerpt || '';

  const handleCopyText = () => {
    navigator.clipboard.writeText(displayText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyHash = () => {
    if (source.contentHash) {
      navigator.clipboard.writeText(source.contentHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDownloadExtractedText = () => {
    const blob = new Blob([displayText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source.filename.replace(/\.[^/.]+$/, '')}_extracted.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadOriginal = async () => {
    try {
      const stored = await getStoredFile(source.id);
      if (stored && stored.blob) {
        const url = URL.createObjectURL(stored.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = stored.filename || source.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Fallback: download extracted text
        handleDownloadExtractedText();
      }
    } catch (err) {
      console.warn('Original file download failed, downloading text instead:', err);
      handleDownloadExtractedText();
    }
  };

  const handleDelete = () => {
    if (onDeleteSource) {
      onDeleteSource(source.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-[#25245F] dark:border-[#55C7C2]/50 shadow-[6px_6px_0px_#25245F] dark:shadow-[6px_6px_0px_rgba(85,199,194,0.3)] flex flex-col overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-200 dark:border-[#2D2C68] bg-[#25245F] dark:bg-[#15143C] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <SourceType3DGlyph type={source.type} size="md" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70 font-mono">
                <span className="font-bold text-white">{source.id}</span>
                <span>·</span>
                <span className="uppercase font-semibold text-[#55C7C2]">{source.type}</span>
                <span>·</span>
                <span>{source.size}</span>
                <span>·</span>
                {isUserUploaded ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    USER UPLOADED · INDEXEDDB
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white/90 border border-white/20">
                    SYNTHETIC DEMO ARTIFACT
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white leading-tight truncate mt-0.5">
                {source.title}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {onReconstructSource && (
              <button
                onClick={() => {
                  onClose();
                  onReconstructSource(source);
                }}
                className="px-3 py-1.5 text-xs font-bold text-[#25245F] bg-[#55C7C2] hover:bg-[#46B3AE] rounded-lg shadow-[2px_2px_0px_#F36B3F] transition-all flex items-center gap-1.5 cursor-pointer"
                title="Extract structured knowledge claims with Gemini 3.8 Flash"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#25245F]" />
                <span className="hidden sm:inline">{sourceClaims.length > 0 ? 'Reprocess Claims' : 'Reconstruct with Gemini'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] text-xs">
            <div>
              <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Author / Lead</span>
              <span className="font-semibold text-neutral-800 dark:text-[#FFF4E3] truncate block">{source.author}</span>
            </div>
            <div>
              <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Ingested At</span>
              <span className="font-semibold text-neutral-800 dark:text-[#FFF4E3]">{source.ingestedAt}</span>
            </div>
            <div>
              <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">
                {source.type === 'pdf' ? 'Pages / Length' : 'Word & Char Count'}
              </span>
              <span className="font-mono font-bold text-[#25245F] dark:text-[#55C7C2]">
                {source.type === 'pdf' && source.pageCount
                  ? `${source.pageCount} page(s) · ${(source.charCount || displayText.length).toLocaleString()} chars`
                  : `${(source.wordCount || 0).toLocaleString()} words · ${(source.charCount || displayText.length).toLocaleString()} chars`}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 dark:text-[#8E8DAF] block text-[10px] uppercase font-bold">Extraction Status</span>
              {source.extractionStatus === 'unsupported_scanned' ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Scanned / No Text
                </span>
              ) : source.status === 'error' || source.extractionStatus === 'failed' ? (
                <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                  <AlertCircle className="w-3 h-3" />
                  Extraction Failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Text Extracted
                </span>
              )}
            </div>
          </div>

          {/* Cryptographic SHA-256 Fingerprint */}
          {source.contentHash && (
            <div className="flex items-center justify-between p-2.5 bg-neutral-100/70 dark:bg-[#14133B] rounded-lg border border-neutral-200 dark:border-[#2D2C68] text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Hash className="w-3.5 h-3.5 text-[#55C7C2] shrink-0" />
                <span className="text-[11px] font-bold text-neutral-500 dark:text-[#8E8DAF] uppercase tracking-wider shrink-0">
                  SHA-256 Fingerprint:
                </span>
                <span className="font-mono text-[11px] text-neutral-800 dark:text-[#C4C3E0] truncate">
                  {source.contentHash}
                </span>
              </div>
              <button
                onClick={handleCopyHash}
                className="text-[11px] text-[#25245F] dark:text-[#55C7C2] hover:underline font-bold shrink-0 ml-2 cursor-pointer flex items-center gap-1"
              >
                {copiedHash ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <span>Copy Hash</span>
                )}
              </button>
            </div>
          )}

          {/* Error Message Alert (if present) */}
          {source.errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Extraction Limitation / Notice:</strong>
                <span>{source.errorMessage}</span>
              </div>
            </div>
          )}

          {/* Synthesized Overview */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-[#C4C3E0] mb-2">
              Synthesized Overview
            </h4>
            <p className="text-xs sm:text-sm text-neutral-700 dark:text-[#C4C3E0] leading-relaxed bg-[#FFF4E3]/40 dark:bg-[#14133B] p-3.5 rounded-lg border-2 border-[#E5B25D]/40 dark:border-[#2D2C68]">
              {source.summary}
            </p>
          </div>

          {/* Extracted Document Inspection Tabs */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-neutral-200 dark:border-[#2D2C68] pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab('extracted')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'extracted'
                      ? 'bg-[#25245F] text-white dark:bg-[#55C7C2] dark:text-[#111033]'
                      : 'text-neutral-600 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F]'
                  }`}
                >
                  Full Extracted Text
                </button>

                {isPdfWithPages && (
                  <button
                    onClick={() => setActiveTab('pages')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      activeTab === 'pages'
                        ? 'bg-[#25245F] text-white dark:bg-[#55C7C2] dark:text-[#111033]'
                        : 'text-neutral-600 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F]'
                    }`}
                  >
                    Page-by-Page View ({source.pages?.length} Pages)
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('excerpt')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'excerpt'
                      ? 'bg-[#25245F] text-white dark:bg-[#55C7C2] dark:text-[#111033]'
                      : 'text-neutral-600 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F]'
                  }`}
                >
                  Citation Excerpt
                </button>

                <button
                  onClick={() => setActiveTab('claims')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'claims'
                      ? 'bg-[#25245F] text-white dark:bg-[#55C7C2] dark:text-[#111033]'
                      : 'text-neutral-600 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F]'
                  }`}
                >
                  Grounded Claims ({sourceClaims.length})
                </button>
              </div>

              {/* Utility actions: Copy & Download */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyText}
                  className="px-2.5 py-1 text-xs font-bold text-neutral-700 dark:text-[#FFF4E3] bg-neutral-100 dark:bg-[#14133B] hover:bg-neutral-200 dark:hover:bg-[#25245F] rounded-md border border-neutral-300 dark:border-[#35337C] transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy text to clipboard"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadOriginal}
                  className="px-2.5 py-1 text-xs font-bold text-neutral-700 dark:text-[#FFF4E3] bg-neutral-100 dark:bg-[#14133B] hover:bg-neutral-200 dark:hover:bg-[#25245F] rounded-md border border-neutral-300 dark:border-[#35337C] transition-colors flex items-center gap-1 cursor-pointer"
                  title="Download document content"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Full Extracted Text */}
            {activeTab === 'extracted' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF]">
                  <span>Actual extracted text from document parser</span>
                  <span className="font-mono">{(source.charCount || displayText.length).toLocaleString()} characters</span>
                </div>
                <div className="bg-neutral-900 dark:bg-[#0E0D24] text-neutral-100 p-4 rounded-lg font-mono text-xs leading-relaxed max-h-96 overflow-y-auto border-2 border-neutral-800 dark:border-[#2D2C68] whitespace-pre-wrap selection:bg-[#F36B3F]/40 selection:text-white">
                  {displayText || '(No extracted text content)'}
                </div>
              </div>
            )}

            {/* TAB 2: Page-by-Page PDF View */}
            {activeTab === 'pages' && isPdfWithPages && (
              <div className="space-y-3">
                {/* Page Selection Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-[#8E8DAF] uppercase shrink-0 mr-1">
                    Select Page:
                  </span>
                  {source.pages?.map((pg) => (
                    <button
                      key={pg.pageNumber}
                      onClick={() => setSelectedPageNum(pg.pageNumber)}
                      className={`px-3 py-1 rounded-md font-mono text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        selectedPageNum === pg.pageNumber
                          ? 'bg-[#F36B3F] text-white shadow-[2px_2px_0px_#25245F]'
                          : 'bg-neutral-100 dark:bg-[#14133B] text-neutral-700 dark:text-[#C4C3E0] hover:bg-neutral-200 dark:hover:bg-[#25245F]'
                      }`}
                    >
                      Page {pg.pageNumber}
                    </button>
                  ))}
                </div>

                {/* Page Content Inspector */}
                {(() => {
                  const currentPage = source.pages?.find((p) => p.pageNumber === selectedPageNum);
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF] px-1 font-mono">
                        <span>Page {selectedPageNum} of {source.pages?.length}</span>
                        <span>{currentPage?.charCount.toLocaleString() || 0} characters</span>
                      </div>
                      <div className="bg-neutral-900 dark:bg-[#0E0D24] text-neutral-100 p-4 rounded-lg font-mono text-xs leading-relaxed max-h-80 overflow-y-auto border-2 border-neutral-800 dark:border-[#2D2C68] whitespace-pre-wrap selection:bg-[#F36B3F]/40">
                        {currentPage?.text || '(Empty text on this page)'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 3: Citation Excerpt */}
            {activeTab === 'excerpt' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-[#8E8DAF]">
                  <span>Representative citation excerpt</span>
                  <span className="font-mono">{source.filename}</span>
                </div>
                <div className="bg-neutral-900 dark:bg-[#0E0D24] text-neutral-200 p-4 rounded-lg font-mono text-xs leading-relaxed overflow-x-auto border-2 border-neutral-800 dark:border-[#2D2C68] whitespace-pre-wrap">
                  {source.rawExcerpt}
                </div>
              </div>
            )}

            {/* TAB 4: Grounded Claims */}
            {activeTab === 'claims' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600 dark:text-[#C4C3E0] font-semibold">
                    Claims derived from this source ({sourceClaims.length})
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToLedger();
                    }}
                    className="text-xs text-[#25245F] dark:text-[#55C7C2] hover:text-[#F36B3F] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>View in Knowledge Ledger</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {sourceClaims.length === 0 ? (
                  <div className="p-8 text-center space-y-3 bg-neutral-50 dark:bg-[#14133B] rounded-xl border-2 border-dashed border-neutral-300 dark:border-[#2D2C68]">
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#55C7C2]/20 text-[#25245F] dark:text-[#55C7C2] flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-[#55C7C2]" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-neutral-800 dark:text-[#FFF4E3]">
                        No Knowledge Claims Reconstructed Yet
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] max-w-sm mx-auto">
                        Run the Gemini 3.8 Flash reconstruction engine to extract atomic technical assertions, requirements, and constraints with verbatim evidence quotes.
                      </p>
                    </div>
                    {onReconstructSource && (
                      <button
                        onClick={() => {
                          onClose();
                          onReconstructSource(source);
                        }}
                        className="px-4 py-2 text-xs font-bold text-white bg-[#F36B3F] hover:bg-[#E0572C] rounded-lg border-2 border-[#F36B3F] shadow-[2px_2px_0px_#25245F] dark:shadow-[2px_2px_0px_#55C7C2] transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Reconstruct Claims with Gemini</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {sourceClaims.map((claim) => (
                      <div
                        key={claim.id}
                        onClick={() => {
                          onClose();
                          onInspectClaim(claim);
                        }}
                        className="p-3 bg-white dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] hover:border-[#25245F]/40 dark:hover:border-[#55C7C2]/40 cursor-pointer transition-colors flex items-start justify-between gap-3 group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono font-bold text-[#25245F] dark:text-[#55C7C2] group-hover:text-[#F36B3F] transition-colors">
                              {claim.id}
                            </span>
                            <span className="text-neutral-400 dark:text-neutral-600">·</span>
                            <span className="text-neutral-600 dark:text-[#C4C3E0] font-medium">{claim.category}</span>
                            <span className="text-neutral-400 dark:text-neutral-600">·</span>
                            <span className="text-neutral-500 dark:text-[#8E8DAF] font-mono text-[11px]">{claim.sourceLocation}</span>
                          </div>
                          <p className="text-xs text-neutral-800 dark:text-[#C4C3E0] line-clamp-2">
                            {claim.statement}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-xs font-mono font-bold text-neutral-900 dark:text-[#FFF4E3]">
                            {claim.confidenceScore}%
                          </span>
                          <div className="text-[10px] text-neutral-400 dark:text-[#8E8DAF] capitalize font-medium">
                            {claim.verificationStatus}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-50 dark:bg-[#14133B] border-t-2 border-neutral-200 dark:border-[#2D2C68] text-xs">
          <div className="flex items-center gap-3">
            {isUserUploaded && onDeleteSource && (
              <>
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 font-bold">Confirm delete this source?</span>
                    <button
                      onClick={handleDelete}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setIsDeleting(false)}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-[#C4C3E0] hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsDeleting(true)}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Source Record</span>
                  </button>
                )}
              </>
            )}
            {!isUserUploaded && (
              <span className="text-neutral-500 dark:text-[#8E8DAF]">
                Synthetic demonstration source · Read-only reference
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-neutral-800 dark:text-[#FFF4E3] bg-white dark:bg-[#25245F] border-2 border-neutral-300 dark:border-[#35337C] rounded-lg hover:bg-neutral-100 dark:hover:bg-[#2D2B75] shadow-[2px_2px_0px_rgba(0,0,0,0.1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
