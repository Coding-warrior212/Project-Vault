/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Source } from '../../types';
import {
  X,
  Upload,
  Github,
  FileCode,
  FileText,
  Check,
  Sparkles,
  Info,
  AlertCircle,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import {
  validateFile,
  formatBytes,
  computeFileHash,
  extractDocument,
  sanitizeFilename,
} from '../../services/extractor';
import { saveStoredSource, saveStoredFile, findDuplicateSourceByHash } from '../../services/db';
import { useWorkspaceSession } from '../auth/WorkspaceSessionContext';
import { findWorkspaceDuplicateSourceByHash, saveWorkspaceSource, uploadWorkspaceSourceFile } from '../../services/workspaceCloud';
import { fetchPublicGitHubSnapshot } from '../../services/githubSnapshot';

interface ConnectSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (newSource: Source) => void;
}

export const ConnectSourceModal: React.FC<ConnectSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
}) => {
  const cloud = useWorkspaceSession();
  const [activeTab, setActiveTab] = React.useState<'upload' | 'github' | 'paste'>('upload');
  const [title, setTitle] = React.useState('');
  const [repoUrl, setRepoUrl] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [pastedContent, setPastedContent] = React.useState('');

  // Real file selection
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setIsProcessing(false);
      setErrorMessage(null);
      setTitle('');
      setSummary('');
      setPastedContent('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validation = validateFile(file);
      if (!validation.isValid) {
        setErrorMessage(validation.error || 'Invalid file.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(sanitizeFilename(file.name).replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Case 1: Real file upload
    if (activeTab === 'upload') {
      if (!selectedFile) {
        setErrorMessage('Please select a PDF, Markdown, or Plain text file to ingest.');
        return;
      }

      setIsProcessing(true);
      try {
        const hash = await computeFileHash(selectedFile);
        const duplicate = cloud
          ? await findWorkspaceDuplicateSourceByHash(cloud.workspace.id, hash)
          : await findDuplicateSourceByHash(hash);
        if (duplicate) {
          setErrorMessage(`File "${selectedFile.name}" is already ingested in ProjectVault ("${duplicate.title}"). Duplicate prevented.`);
          setIsProcessing(false);
          return;
        }

        const extracted = await extractDocument(selectedFile);
        const sourceId = `src-usr-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
        const cleanName = sanitizeFilename(selectedFile.name);

        const newSource: Source = {
          id: sourceId,
          title: title || cleanName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          type: selectedFile.name.endsWith('.pdf') ? 'pdf' : selectedFile.name.endsWith('.md') ? 'markdown' : 'text',
          filename: cleanName,
          size: formatBytes(selectedFile.size),
          sizeBytes: selectedFile.size,
          ingestedAt: 'Just now',
          timestamp: Date.now(),
          claimsCount: 0,
          status: extracted.extractionStatus === 'failed' ? 'error' : 'ingested',
          extractionStatus: extracted.extractionStatus,
          author: 'You (Active Session)',
          summary: summary || extracted.summary,
          rawExcerpt: extracted.rawExcerpt,
          extractedText: extracted.text,
          pages: extracted.pages,
          pageCount: extracted.pageCount,
          charCount: extracted.charCount,
          wordCount: extracted.wordCount,
          errorMessage: extracted.errorMessage,
          contentHash: hash,
          isUserUploaded: true,
          mimeType: selectedFile.type,
          tags: ['User Upload', 'IndexedDB'],
        };

        if (cloud) {
          await saveWorkspaceSource(cloud.workspace.id, newSource);
          await uploadWorkspaceSourceFile(cloud.workspace.id, newSource, selectedFile);
        } else {
          await saveStoredSource(newSource);
          await saveStoredFile(sourceId, selectedFile);
        }

        onAddSource(newSource);
        onClose();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to extract text from document.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Case 2: Pasted Text Spec
    if (activeTab === 'paste') {
      if (!pastedContent.trim()) {
        setErrorMessage('Please enter or paste specification text.');
        return;
      }

      setIsProcessing(true);
      try {
        const sourceId = `src-usr-txt-${Date.now().toString().slice(-6)}`;
        const cleanTitle = title || 'Pasted Engineering Specification';
        const filename = `${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
        const charCount = pastedContent.length;
        const wordCount = pastedContent.trim().split(/\s+/).length;
        const textFile = new globalThis.File([pastedContent], filename, { type: 'text/plain;charset=utf-8' });
        const hash = await computeFileHash(textFile);

        const newSource: Source = {
          id: sourceId,
          title: cleanTitle,
          type: 'text',
          filename,
          size: formatBytes(charCount),
          sizeBytes: charCount,
          ingestedAt: 'Just now',
          timestamp: Date.now(),
          claimsCount: 0,
          status: 'ingested',
          extractionStatus: 'success',
          author: 'You (Pasted Spec)',
          summary: summary || `Directly pasted specification containing ${wordCount} words and ${charCount} characters.`,
          rawExcerpt: pastedContent.slice(0, 300),
          extractedText: pastedContent,
          charCount,
          wordCount,
          contentHash: hash,
          isUserUploaded: true,
          mimeType: 'text/plain',
          tags: ['Pasted Text', 'User Upload', 'IndexedDB'],
        };

        if (cloud) {
          await saveWorkspaceSource(cloud.workspace.id, newSource);
          await uploadWorkspaceSourceFile(cloud.workspace.id, newSource, textFile);
        } else {
          await saveStoredSource(newSource);
          await saveStoredFile(sourceId, textFile);
        }

        onAddSource(newSource);
        onClose();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to save pasted specification.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Case 3: Fetch a real, bounded documentation snapshot from a public GitHub repository.
    setIsProcessing(true);
    try {
      const snapshot = await fetchPublicGitHubSnapshot(repoUrl, branch);
      const textFile = new globalThis.File([snapshot.snapshot], `${snapshot.repo}-${snapshot.branch}-snapshot.md`, { type: 'text/markdown' });
      const hash = await computeFileHash(textFile);
      const duplicate = cloud
        ? await findWorkspaceDuplicateSourceByHash(cloud.workspace.id, hash)
        : await findDuplicateSourceByHash(hash);
      if (duplicate) throw new Error(`This exact repository snapshot is already connected as "${duplicate.title}".`);
      const sourceId = `src-gh-${Date.now().toString().slice(-7)}-${Math.random().toString(36).slice(2, 5)}`;
      const cleanTitle = title || `${snapshot.owner}/${snapshot.repo} (${snapshot.branch})`;
      const newSource: Source = {
        id: sourceId, title: cleanTitle, type: 'github',
        filename: `${snapshot.owner}/${snapshot.repo}@${snapshot.branch}`,
        repoBranch: snapshot.branch, githubOwner: snapshot.owner, githubRepo: snapshot.repo,
        githubUrl: snapshot.url, commitSha: snapshot.commitSha, lastSyncedAt: new Date().toISOString(),
        size: formatBytes(textFile.size), sizeBytes: textFile.size, ingestedAt: 'Just now',
        timestamp: Date.now(), claimsCount: 0, status: 'ingested', extractionStatus: 'success',
        author: snapshot.owner, summary: summary || `${snapshot.description} Snapshot includes ${snapshot.filesIncluded} documentation files at commit ${snapshot.commitSha.slice(0, 12)}.`,
        rawExcerpt: snapshot.snapshot.slice(0, 300), extractedText: snapshot.snapshot,
        charCount: snapshot.snapshot.length, wordCount: snapshot.snapshot.trim().split(/\\s+/).length,
        contentHash: hash, isUserUploaded: true, mimeType: 'text/markdown',
        tags: ['GitHub', 'Public Repository', 'Documentation Snapshot'],
      };
      if (cloud) {
        await saveWorkspaceSource(cloud.workspace.id, newSource);
        await uploadWorkspaceSourceFile(cloud.workspace.id, newSource, textFile);
      } else {
        await saveStoredSource(newSource);
        await saveStoredFile(sourceId, textFile);
      }
      onAddSource(newSource);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not connect to this public GitHub repository.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-[#25245F] dark:border-[#55C7C2]/50 shadow-[6px_6px_0px_#25245F] dark:shadow-[6px_6px_0px_rgba(85,199,194,0.3)] flex flex-col overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-200 dark:border-[#2D2C68] bg-[#25245F] dark:bg-[#15143C] text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-white border border-white/20">
              <Sparkles className="w-4 h-4 text-[#55C7C2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Connect Project Artifact
              </h3>
              <p className="text-xs text-white/70">
                Upload real documents or connect project repositories
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Error notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-900/50 rounded-lg text-rose-900 dark:text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Source Type Selector */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-[#14133B] rounded-lg border border-neutral-200 dark:border-[#2D2C68]">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-1.5 text-center rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex-1 py-1.5 text-center rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Paste Text</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('github')}
              className={`flex-1 py-1.5 text-center rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'github'
                  ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub Repo</span>
            </button>
          </div>

          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-700 dark:text-[#C4C3E0] font-bold mb-1">
                  Select Document (.pdf, .md, .txt)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.md,.txt,text/markdown,text/plain,application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-xs p-2 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] rounded-lg file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-[#25245F] file:text-white dark:file:bg-[#55C7C2] dark:file:text-[#111033] cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono mt-1">
                    Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-[#C4C3E0] font-bold mb-1">
                  Custom Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Telemetry Ingestion Architecture Spec"
                  className="w-full p-2.5 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] placeholder-neutral-400 dark:placeholder-[#8E8DAF] focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2]"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Paste Raw Spec Text */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-700 dark:text-[#C4C3E0] font-bold mb-1">
                  Specification Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Memory Safety & Watchdog Configuration"
                  className="w-full p-2.5 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] placeholder-neutral-400 dark:placeholder-[#8E8DAF] focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2]"
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-[#C4C3E0] font-bold mb-1">
                  Paste Specification Text
                </label>
                <textarea
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Paste engineering notes, markdown, or plain text here..."
                  rows={4}
                  className="w-full p-2.5 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] placeholder-neutral-400 dark:placeholder-[#8E8DAF] font-mono focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2]"
                />
              </div>
            </div>
          )}

          {/* TAB 3: GitHub Repo */}
          {activeTab === 'github' && (
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-700 dark:text-[#C4C3E0] font-bold mb-1">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] rounded-lg font-mono text-neutral-900 dark:text-[#FFF4E3] focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2]"
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-[#C4C3E0] font-bold mb-1">
                  Target Branch
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] rounded-lg font-mono text-neutral-900 dark:text-[#FFF4E3] focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2]"
                />
              </div>
            </div>
          )}

          {activeTab === 'github' && <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-[11px] leading-5 text-sky-900">Public repositories only. ProjectVault snapshots the repository README and up to seven Markdown documentation files from the selected branch and records the commit SHA. Private repositories and automatic background sync are not enabled.</p>}

          {/* Local Persistence Notice */}
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg border-2 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 flex items-start gap-2 text-[11px] leading-relaxed">
            <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              {cloud ? <><strong>Private workspace storage:</strong> Files are uploaded to the selected workspace's private Supabase Storage bucket. Access is enforced by workspace membership policies.</> : <><strong>Local demo persistence:</strong> Ingested files and extracted text stay in this browser's IndexedDB.</>}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-neutral-200 dark:border-[#2D2C68]">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-3.5 py-2 font-medium text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 text-white dark:text-[#111033] bg-[#25245F] dark:bg-[#55C7C2] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] font-bold rounded-lg border-2 border-[#25245F] dark:border-[#55C7C2] shadow-[3px_3px_0px_#55C7C2] dark:shadow-[3px_3px_0px_#25245F] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#55C7C2] dark:text-[#111033]" />
                  <span>Extracting & Ingesting...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-[#55C7C2] dark:text-[#111033]" />
                  <span>{activeTab === 'upload' ? 'Upload & Extract Document' : activeTab === 'paste' ? 'Ingest Specification Text' : 'Connect Repository'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
