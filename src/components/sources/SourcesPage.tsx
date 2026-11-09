/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Source, SourceType, SourceStatus } from '../../types';
import {
  Upload,
  FileText,
  FolderGit2,
  Github,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  Plus,
  ExternalLink,
  ChevronRight,
  FileCode,
  File,
  Eye,
  AlertCircle,
  RefreshCw,
  Info,
  X,
  Trash2,
  Check,
  HardDrive,
  Sparkles,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { SourceType3DGlyph, EmptyVault3D } from '../common/Soft3DVisuals';
import {
  validateFile,
  formatBytes,
  computeFileHash,
  extractDocument,
  sanitizeFilename,
} from '../../services/extractor';
import {
  saveStoredSource,
  saveStoredFile,
  findDuplicateSourceByHash,
  deleteStoredSource,
} from '../../services/db';

interface UploadQueueItem {
  id: string;
  fileName: string;
  fileSize: string;
  progress: number;
  message: string;
  status: 'validating' | 'extracting' | 'saving' | 'completed' | 'error';
  error?: string;
}

interface SourcesPageProps {
  sources: Source[];
  onOpenSourceDetail: (source: Source) => void;
  onOpenConnectModal: () => void;
  onSourceAdded?: (newSource: Source) => void;
  onSourceDeleted?: (sourceId: string) => void;
  onReconstructSource?: (source: Source) => void;
  onNavigateToLedger?: (sourceId?: string) => void;
  isLoading?: boolean;
}

export const SourcesPage: React.FC<SourcesPageProps> = ({
  sources,
  onOpenSourceDetail,
  onOpenConnectModal,
  onSourceAdded,
  onSourceDeleted,
  onReconstructSource,
  onNavigateToLedger,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [selectedOrigin, setSelectedOrigin] = React.useState<'all' | 'user' | 'demo'>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [viewState, setViewState] = React.useState<'populated' | 'empty' | 'loading' | 'error'>('populated');

  // Drag & drop state
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Active upload & processing feedback queue
  const [uploadQueue, setUploadQueue] = React.useState<UploadQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Feedback notifications
  const [uploadFeedback, setUploadFeedback] = React.useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    messages: string[];
  } | null>(null);

  // Deletion confirmation dialog state
  const [deletingSourceId, setDeletingSourceId] = React.useState<string | null>(null);

  // Counters
  const userUploadedCount = sources.filter((s) => s.isUserUploaded).length;
  const demoSourcesCount = sources.length - userUploadedCount;

  // Filter sources
  const filteredSources = sources.filter((source) => {
    const matchesSearch =
      source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (source.extractedText && source.extractedText.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedType === 'all' || source.type === selectedType;

    const matchesOrigin =
      selectedOrigin === 'all' ||
      (selectedOrigin === 'user' && source.isUserUploaded) ||
      (selectedOrigin === 'demo' && !source.isUserUploaded);

    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'extracted' && (source.status === 'ingested' && source.extractionStatus !== 'unsupported_scanned')) ||
      (selectedStatus === 'scanned' && source.extractionStatus === 'unsupported_scanned') ||
      (selectedStatus === 'error' && (source.status === 'error' || source.extractionStatus === 'failed')) ||
      (selectedStatus === 'review' && source.status === 'needs_review');

    return matchesSearch && matchesType && matchesOrigin && matchesStatus;
  });

  /**
   * Process multiple dropped or selected files
   */
  const handleProcessFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setIsProcessing(true);
    setUploadFeedback(null);

    const queueItems: UploadQueueItem[] = fileList.map((f, idx) => ({
      id: `queue-${Date.now()}-${idx}`,
      fileName: f.name,
      fileSize: formatBytes(f.size),
      progress: 5,
      message: 'Queued for validation...',
      status: 'validating',
    }));

    setUploadQueue(queueItems);

    const errors: string[] = [];
    const successes: string[] = [];
    const duplicates: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const queueId = queueItems[i].id;

      // Helper to update individual queue item progress
      const updateQueue = (updates: Partial<UploadQueueItem>) => {
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === queueId ? { ...item, ...updates } : item))
        );
      };

      try {
        // Step 1: Validation
        updateQueue({ progress: 15, message: 'Validating format and size...' });
        const validation = validateFile(file);

        if (!validation.isValid || !validation.type) {
          const err = validation.error || `Invalid file "${file.name}".`;
          errors.push(err);
          updateQueue({ progress: 100, status: 'error', error: err, message: 'Validation failed' });
          continue;
        }

        // Step 2: Content Hash & Duplicate Check
        updateQueue({ progress: 30, message: 'Computing SHA-256 fingerprint...' });
        const hash = await computeFileHash(file);

        // Check if hash already exists in memory or IndexedDB
        const duplicateInMemory = sources.find((s) => s.contentHash === hash);
        const duplicateInDB = duplicateInMemory ? null : await findDuplicateSourceByHash(hash);
        const duplicate = duplicateInMemory || duplicateInDB;

        if (duplicate) {
          const dupMsg = `File "${file.name}" is identical to an already ingested source ("${duplicate.title}") and was skipped to prevent duplication.`;
          duplicates.push(dupMsg);
          updateQueue({
            progress: 100,
            status: 'completed',
            message: 'Duplicate skipped (already ingested)',
          });
          continue;
        }

        // Step 3: Real Text Extraction
        updateQueue({ progress: 45, status: 'extracting', message: 'Extracting actual text...' });

        const extracted = await extractDocument(file, (msg, pct) => {
          updateQueue({ progress: Math.min(pct, 90), message: msg });
        });

        // Step 4: Construct Real Source Record
        updateQueue({ progress: 92, status: 'saving', message: 'Saving to local IndexedDB...' });

        const sourceId = `src-usr-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
        const cleanName = sanitizeFilename(file.name);
        const title = cleanName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const newSource: Source = {
          id: sourceId,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          type: validation.type,
          filename: cleanName,
          size: formatBytes(file.size),
          sizeBytes: file.size,
          ingestedAt: 'Just now',
          timestamp: Date.now(),
          claimsCount: 0, // Real claims will be extracted in Stage 2 (RECONSTRUCT)
          status: extracted.extractionStatus === 'failed' ? 'error' : 'ingested',
          extractionStatus: extracted.extractionStatus,
          author: 'You (Active Session)',
          summary: extracted.summary,
          rawExcerpt: extracted.rawExcerpt,
          extractedText: extracted.text,
          pages: extracted.pages,
          pageCount: extracted.pageCount,
          charCount: extracted.charCount,
          wordCount: extracted.wordCount,
          errorMessage: extracted.errorMessage,
          contentHash: hash,
          isUserUploaded: true,
          mimeType: file.type || (validation.type === 'pdf' ? 'application/pdf' : 'text/plain'),
          tags: [validation.type.toUpperCase(), 'User Upload', 'IndexedDB'],
        };

        // Step 5: Persist to IndexedDB
        await saveStoredSource(newSource);
        await saveStoredFile(sourceId, file);

        // Notify parent state
        if (onSourceAdded) {
          onSourceAdded(newSource);
        }

        updateQueue({
          progress: 100,
          status: 'completed',
          message: `Ingested ${extracted.charCount.toLocaleString()} chars`,
        });

        successes.push(`"${cleanName}": Extracted ${extracted.charCount.toLocaleString()} characters.`);
      } catch (err: any) {
        console.error(`Error processing file ${file.name}:`, err);
        const errMsg = err?.message || `Failed to process "${file.name}".`;
        errors.push(errMsg);
        updateQueue({ progress: 100, status: 'error', error: errMsg, message: 'Processing failed' });
      }
    }

    setIsProcessing(false);

    // Build consolidated feedback report
    if (successes.length > 0 && errors.length === 0 && duplicates.length === 0) {
      setUploadFeedback({
        type: 'success',
        title: `Successfully Ingested ${successes.length} Document(s)`,
        messages: successes,
      });
    } else if (errors.length > 0 || duplicates.length > 0) {
      setUploadFeedback({
        type: errors.length > 0 && successes.length === 0 ? 'error' : 'warning',
        title: `Ingestion Completed with Notices (${successes.length} succeeded, ${duplicates.length} duplicates, ${errors.length} failed)`,
        messages: [...successes, ...duplicates, ...errors],
      });
    }

    // Auto-clear successful queue items after 6 seconds
    setTimeout(() => {
      setUploadQueue((prev) => prev.filter((item) => item.status === 'error'));
    }, 6000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFiles(e.target.files);
      e.target.value = ''; // Reset input so same file can be re-selected if deleted
    }
  };

  const handleDeleteConfirmed = async (sourceId: string) => {
    try {
      await deleteStoredSource(sourceId);
      if (onSourceDeleted) {
        onSourceDeleted(sourceId);
      }
      setDeletingSourceId(null);
    } catch (err) {
      console.error('Failed to delete source from IndexedDB:', err);
    }
  };

  const getStatusBadge = (source: Source) => {
    if (source.extractionStatus === 'unsupported_scanned') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-800/40">
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Scanned / No Text
        </span>
      );
    }

    if (source.status === 'error' || source.extractionStatus === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded border border-rose-300 dark:border-rose-800/40">
          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          Parse Error
        </span>
      );
    }

    if (source.status === 'needs_review') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F36B3F] bg-orange-50 dark:bg-orange-950/40 px-2.5 py-0.5 rounded border border-orange-200 dark:border-orange-800/40">
          <AlertTriangle className="w-3 h-3 text-[#F36B3F]" />
          Has Conflicts
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/40">
        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        {source.isUserUploaded ? 'Extracted & Stored' : 'Ingested & Parsed'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Scope Notice with Stage 1 Indicator */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-6 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 bg-[#25245F] dark:bg-[#2D2B75] text-white rounded border border-[#25245F] dark:border-[#55C7C2]/40">
                Stage 1 / 5 · CONNECT
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-300 dark:border-emerald-700/50 font-bold flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                INDEXEDDB LOCAL PERSISTENCE ACTIVE
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">·</span>
              <span className="text-xs text-neutral-600 dark:text-[#C4C3E0] font-mono">
                {userUploadedCount} user-uploaded · {demoSourcesCount} demo sources
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-[#FFF4E3]">
              Project Artifacts & Evidence Repository
            </h2>
            <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] max-w-2xl leading-relaxed">
              Upload actual engineering specifications, PDF architectural blueprints, and Markdown runbooks. ProjectVault extracts verbatim text client-side via WebAssembly and persists sources directly in your browser's IndexedDB. Data remains local to your device.
            </p>
          </div>

          {/* Interactive State Simulator Bar for Evaluation */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#14133B] p-1 rounded-lg shrink-0 self-start text-xs border-2 border-neutral-200 dark:border-[#2D2C68]">
            <span className="text-[10px] font-bold uppercase text-neutral-500 dark:text-[#8E8DAF] px-2">
              Preview State:
            </span>
            <button
              onClick={() => setViewState('populated')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                viewState === 'populated'
                  ? 'bg-white dark:bg-[#25245F] text-neutral-900 dark:text-white shadow-xs font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Populated ({sources.length})
            </button>
            <button
              onClick={() => setViewState('empty')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                viewState === 'empty'
                  ? 'bg-white dark:bg-[#25245F] text-neutral-900 dark:text-white shadow-xs font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Empty
            </button>
            <button
              onClick={() => setViewState('loading')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                viewState === 'loading'
                  ? 'bg-white dark:bg-[#25245F] text-neutral-900 dark:text-white shadow-xs font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => setViewState('error')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                viewState === 'error'
                  ? 'bg-white dark:bg-[#25245F] text-neutral-900 dark:text-white shadow-xs font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Error
            </button>
          </div>
        </div>
      </div>

      {/* Upload Feedback Banner */}
      {uploadFeedback && (
        <div
          className={`p-4 rounded-xl border-2 neo-box-sm text-xs space-y-1.5 transition-all ${
            uploadFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200'
              : uploadFeedback.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 text-rose-950 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              {uploadFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
              <span>{uploadFeedback.title}</span>
            </div>
            <button
              onClick={() => setUploadFeedback(null)}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-xs opacity-90">
            {uploadFeedback.messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Zone & GitHub Connector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Real Document Upload Dropzone (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-[#F36B3F]" />
              Real Document Upload & Text Extractor
            </h3>
            <span className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] font-mono">
              Max 20 MB · PDF, MD, TXT
            </span>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.md,.txt,text/markdown,text/plain,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-7 text-center transition-all cursor-pointer select-none ${
              isDragOver
                ? 'border-[#F36B3F] bg-orange-50/70 dark:bg-orange-950/30 scale-[1.01]'
                : 'border-neutral-300 dark:border-[#35337C] hover:border-[#25245F] dark:hover:border-[#55C7C2] bg-neutral-50/60 dark:bg-[#14133B]/60'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-2.5">
              <div className="w-12 h-12 rounded-xl bg-[#FFF4E3] dark:bg-[#25245F] text-[#25245F] dark:text-[#55C7C2] border-2 border-[#E5B25D]/50 dark:border-[#55C7C2]/40 flex items-center justify-center shadow-[2px_2px_0px_rgba(37,36,95,0.1)]">
                <Upload className="w-6 h-6 text-[#F36B3F]" />
              </div>

              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-[#FFF4E3]">
                  Drag and drop files here, or <span className="text-[#25245F] dark:text-[#55C7C2] underline decoration-2">browse files</span>
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] mt-0.5">
                  Multi-file upload supported. PDF page structures and Markdown headings are fully preserved.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-neutral-400 dark:text-[#8E8DAF]">
                <span className="px-2 py-0.5 rounded bg-white dark:bg-[#1B1A48] border border-neutral-200 dark:border-[#35337C]">.PDF</span>
                <span className="px-2 py-0.5 rounded bg-white dark:bg-[#1B1A48] border border-neutral-200 dark:border-[#35337C]">.MD</span>
                <span className="px-2 py-0.5 rounded bg-white dark:bg-[#1B1A48] border border-neutral-200 dark:border-[#35337C]">.TXT</span>
                <span>· SHA-256 duplicate detection</span>
              </div>
            </div>
          </div>

          {/* Active Processing / Queue Status */}
          {uploadQueue.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5">
                  <RefreshCw className={`w-3 h-3 text-[#F36B3F] ${isProcessing ? 'animate-spin' : ''}`} />
                  Processing Queue ({uploadQueue.length})
                </span>
                <button
                  onClick={() => setUploadQueue([])}
                  className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                >
                  Dismiss Queue
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {uploadQueue.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg border-2 text-xs transition-colors ${
                      item.status === 'error'
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/40 text-rose-900 dark:text-rose-200'
                        : item.status === 'completed'
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                        : 'bg-neutral-50 dark:bg-[#14133B] border-neutral-200 dark:border-[#2D2C68]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-[#25245F] dark:text-[#55C7C2]" />
                        <span className="font-bold truncate">{item.fileName}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">({item.fileSize})</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold capitalize shrink-0 ml-2">
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            item.status === 'error'
                              ? 'bg-rose-500'
                              : item.status === 'completed'
                              ? 'bg-emerald-500'
                              : 'bg-[#F36B3F]'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-500 dark:text-[#8E8DAF] shrink-0 font-mono">
                        {item.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: GitHub Integration Card (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm flex flex-col justify-between space-y-4 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
                GitHub Repository Connector
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/40">
                Phase 3 Integration
              </span>
            </div>

            <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] leading-relaxed">
              Connect private GitHub repositories to automatically parse architectural ADRs, proto schemas, and CI/CD workflow configurations alongside uploaded specifications.
            </p>

            <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neutral-800 dark:text-[#FFF4E3] font-bold">apex-fleet/telemetry-gateway</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Connected</span>
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] flex items-center gap-2 font-mono">
                <span>Branch: main</span>
                <span>·</span>
                <span>Demo repo attached</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenConnectModal}
            className="w-full py-2.5 text-xs font-bold text-[#25245F] dark:text-[#FFF4E3] bg-[#FFF4E3] dark:bg-[#25245F] hover:bg-[#FFE8C2] dark:hover:bg-[#2F2D73] border-2 border-[#25245F]/40 dark:border-[#55C7C2]/40 rounded-lg shadow-[2px_2px_0px_rgba(37,36,95,0.15)] dark:shadow-[2px_2px_0px_rgba(85,199,194,0.2)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Github className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
            <span>Connect Another Repository (Preview)</span>
          </button>
        </div>
      </div>

      {/* Main Sources Table & Filters */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm overflow-hidden transition-colors">
        {/* Table Filter Header */}
        <div className="p-4 border-b-2 border-neutral-200 dark:border-[#2D2C68] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-neutral-50/50 dark:bg-[#14133B]/60">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-neutral-400 dark:text-[#8E8DAF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, filename, or extracted text..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] text-neutral-900 dark:text-[#FFF4E3] placeholder-neutral-400 dark:placeholder-[#8E8DAF] rounded-lg focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Origin Filter (All / User Uploaded / Demo) */}
            <div className="flex items-center gap-1 p-0.5 bg-neutral-200/60 dark:bg-[#14133B] rounded-lg text-xs border border-neutral-300 dark:border-[#2D2C68]">
              <button
                onClick={() => setSelectedOrigin('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedOrigin === 'all'
                    ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                    : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                All ({sources.length})
              </button>
              <button
                onClick={() => setSelectedOrigin('user')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedOrigin === 'user'
                    ? 'bg-white dark:bg-[#25245F] text-emerald-800 dark:text-emerald-300 shadow-xs font-bold'
                    : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Uploaded ({userUploadedCount})
              </button>
              <button
                onClick={() => setSelectedOrigin('demo')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedOrigin === 'demo'
                    ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                    : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Demo ({demoSourcesCount})
              </button>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 p-0.5 bg-neutral-200/60 dark:bg-[#14133B] rounded-lg text-xs border border-neutral-300 dark:border-[#2D2C68]">
              {['all', 'pdf', 'markdown', 'text', 'github'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-2 py-1 rounded-md capitalize font-medium transition-colors cursor-pointer ${
                    selectedType === type
                      ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                      : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* View States Handler */}
        {isLoading || viewState === 'loading' ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#F36B3F] animate-spin mx-auto" />
            <div className="text-sm font-bold text-neutral-800 dark:text-[#FFF4E3]">
              Loading Project Sources from IndexedDB...
            </div>
            <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] max-w-sm mx-auto">
              Synchronizing local browser persistence with active workspace.
            </p>
          </div>
        ) : viewState === 'error' ? (
          <div className="p-12 text-center space-y-3 bg-rose-50/30 dark:bg-rose-950/20">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Simulated Connection Error
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
              Unable to reach external document repository. Verify network connectivity or authorization credentials and retry.
            </p>
            <button
              onClick={() => setViewState('populated')}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
            >
              Reset to Populated State
            </button>
          </div>
        ) : viewState === 'empty' || filteredSources.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <EmptyVault3D
              message={
                searchQuery || selectedType !== 'all' || selectedOrigin !== 'all'
                  ? 'No project sources match the active filter criteria'
                  : 'No project sources have been uploaded yet'
              }
            />
            <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] max-w-md mx-auto">
              {searchQuery || selectedType !== 'all' || selectedOrigin !== 'all'
                ? 'Try clearing active search queries or filters to see all available project sources.'
                : 'Drag and drop PDF specifications, Markdown documents, or text files into the upload box above.'}
            </p>
            {searchQuery || selectedType !== 'all' || selectedOrigin !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                  setSelectedOrigin('all');
                  setSelectedStatus('all');
                  setViewState('populated');
                }}
                className="px-3 py-1.5 text-xs font-bold text-[#25245F] dark:text-[#55C7C2] bg-neutral-100 dark:bg-[#25245F] hover:bg-neutral-200 dark:hover:bg-[#2D2B75] rounded-lg border border-neutral-300 dark:border-[#35337C] transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#F36B3F] hover:bg-[#E0572C] rounded-lg border-2 border-[#F36B3F] shadow-[3px_3px_0px_#25245F] transition-all cursor-pointer"
              >
                Upload Your First Document
              </button>
            )}
          </div>
        ) : (
          /* Populated Sources Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-[#14133B] border-b-2 border-neutral-200 dark:border-[#2D2C68] text-neutral-500 dark:text-[#8E8DAF] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Source Title & Filename</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Origin</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Ingested</th>
                  <th className="py-3 px-3 text-right">Extracted Content</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-[#2D2C68]">
                {filteredSources.map((source) => (
                  <tr
                    key={source.id}
                    onClick={() => onOpenSourceDetail(source)}
                    className="hover:bg-neutral-50 dark:hover:bg-[#222158]/50 cursor-pointer transition-colors group"
                  >
                    {/* Title & Filename */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 pt-0.5">
                          <SourceType3DGlyph type={source.type} size="md" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-neutral-900 dark:text-[#FFF4E3] group-hover:text-[#25245F] dark:group-hover:text-[#55C7C2] transition-colors truncate">
                            {source.title}
                          </div>
                          <div className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] font-mono flex items-center gap-2 truncate">
                            <span className="truncate">{source.filename}</span>
                            <span>·</span>
                            <span>{source.author}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-3">
                      <span className="font-mono uppercase text-[11px] font-bold text-neutral-700 dark:text-[#C4C3E0]">
                        {source.type}
                      </span>
                    </td>

                    {/* Origin Badge */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {source.isUserUploaded ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#25245F]/50 text-neutral-600 dark:text-[#C4C3E0] border border-neutral-300 dark:border-[#35337C]">
                          Demo
                        </span>
                      )}
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-[#C4C3E0] whitespace-nowrap">
                      {source.size}
                    </td>

                    {/* Ingested Timestamp */}
                    <td className="py-3.5 px-3 text-neutral-500 dark:text-[#8E8DAF] whitespace-nowrap">
                      {source.ingestedAt}
                    </td>

                    {/* Extracted Metrics */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono text-[11px]">
                      <div className="flex flex-col items-end">
                        {source.isUserUploaded ? (
                          <span className="font-bold text-neutral-900 dark:text-[#FFF4E3] tabular-nums">
                            {source.type === 'pdf' && source.pageCount
                              ? `${source.pageCount} pgs · ${(source.charCount || 0).toLocaleString()} chars`
                              : `${(source.charCount || 0).toLocaleString()} chars`}
                          </span>
                        ) : (
                          <span className="text-neutral-500 dark:text-[#8E8DAF]">
                            {(source.charCount || 4200).toLocaleString()} chars
                          </span>
                        )}
                        {source.claimsCount > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToLedger?.(source.id);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-[10px] text-[#25245F] dark:text-[#55C7C2] bg-[#55C7C2]/15 hover:bg-[#55C7C2]/25 px-1.5 py-0.2 rounded border border-[#55C7C2]/30 mt-0.5 transition-colors cursor-pointer"
                            title="Filter Knowledge Ledger for this source"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-[#F36B3F]" />
                            <span>{source.claimsCount} claims</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            No claims yet
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(source)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {onReconstructSource && (
                          <button
                            onClick={() => onReconstructSource(source)}
                            className="px-2 py-1 text-[#25245F] dark:text-[#55C7C2] hover:text-[#F36B3F] dark:hover:text-[#F36B3F] rounded-md hover:bg-orange-50 dark:hover:bg-[#25245F] border border-neutral-200 dark:border-[#2D2C68] transition-colors inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                            title={source.claimsCount > 0 ? 'Reprocess knowledge claims with Gemini' : 'Reconstruct knowledge claims with Gemini 3.8 Flash'}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#F36B3F]" />
                            <span className="hidden sm:inline">{source.claimsCount > 0 ? 'Reprocess' : 'Reconstruct'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => onOpenSourceDetail(source)}
                          className="p-1.5 text-neutral-500 dark:text-[#8E8DAF] hover:text-[#25245F] dark:hover:text-[#FFF4E3] rounded-md hover:bg-neutral-100 dark:hover:bg-[#25245F] transition-colors inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                          title="Inspect extracted text and citation context"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Inspect</span>
                        </button>

                        {source.isUserUploaded && (
                          <>
                            {deletingSourceId === source.id ? (
                              <div className="inline-flex items-center gap-1 ml-1">
                                <button
                                  onClick={() => handleDeleteConfirmed(source.id)}
                                  className="px-2 py-0.5 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeletingSourceId(null)}
                                  className="px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingSourceId(source.id)}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Delete this uploaded source"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
