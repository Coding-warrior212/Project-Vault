/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AppPage,
  Workspace,
  Source,
  KnowledgeClaim,
  ActivityEvent,
  VerificationStatus,
} from './types';
import {
  SAMPLE_WORKSPACES,
  WORKFLOW_STAGES,
  INITIAL_SOURCES,
  INITIAL_CLAIMS,
  SAMPLE_ACTIVITY,
} from './data/sampleData';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewPage } from './components/overview/OverviewPage';
import { SourcesPage } from './components/sources/SourcesPage';
import { SourceDetailModal } from './components/sources/SourceDetailModal';
import { ReconstructModal } from './components/sources/ReconstructModal';
import { KnowledgeLedgerPage } from './components/ledger/KnowledgeLedgerPage';
import { ReviewPage } from './components/review/ReviewPage';
import { KnowledgeGraphPage } from './components/graph/KnowledgeGraphPage';
import { fetchPublicGitHubSnapshot } from './services/githubSnapshot';
import { HandoverPage } from './components/handover/HandoverPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ClaimModal } from './components/common/ClaimModal';
import { ConnectSourceModal } from './components/common/ConnectSourceModal';
import {
  getAllStoredSources,
  deleteStoredSource,
  getAllStoredClaims,
  saveStoredClaims,
  getAllStoredConflicts,
  saveStoredConflicts,
  getAllStoredMissingInfo,
  saveStoredMissingInfo,
  getAllStoredQuestions,
  saveStoredQuestions,
  clearJudgeDemoPersistence,
} from './services/db';
import {
  INITIAL_CONFLICTS,
  INITIAL_MISSING_INFO,
  INITIAL_QUESTIONS,
} from './data/sampleData';
import { ProjectConflict, MissingInfoFinding, UnresolvedQuestion } from './types';
import { useWorkspaceSession } from './components/auth/WorkspaceSessionContext';
import { appendWorkspaceActivity, deleteWorkspaceSource, loadWorkspaceData, saveWorkspaceClaims, saveWorkspaceConflicts, saveWorkspaceMissingInfo, saveWorkspaceQuestions, saveWorkspaceSource, subscribeWorkspaceChanges, updateWorkspaceClaim, uploadWorkspaceSourceFile } from './services/workspaceCloud';

export default function App() {
  const cloud = useWorkspaceSession();
  const activeWorkspaceId = cloud?.workspace.id;
  const activeActor = cloud ? (cloud.session.user.user_metadata?.full_name || cloud.session.user.email || 'Workspace member') : 'Elena Rostova';
  const [currentPage, setCurrentPage] = React.useState<AppPage>('overview');
  const [currentWorkspace, setCurrentWorkspace] = React.useState<Workspace>(() => cloud ? ({
    id: cloud.workspace.id, name: cloud.workspace.name, code: cloud.workspace.code,
    description: cloud.workspace.description, role: cloud.workspace.role,
    projectType: cloud.workspace.projectType, createdAt: new Date().toISOString(),
  }) : SAMPLE_WORKSPACES[0]);
  const [sources, setSources] = React.useState<Source[]>(cloud ? [] : INITIAL_SOURCES);
  const [claims, setClaims] = React.useState<KnowledgeClaim[]>(cloud ? [] : INITIAL_CLAIMS);
  const [conflicts, setConflicts] = React.useState<ProjectConflict[]>(cloud ? [] : INITIAL_CONFLICTS);
  const [missingInfo, setMissingInfo] = React.useState<MissingInfoFinding[]>(cloud ? [] : INITIAL_MISSING_INFO);
  const [questions, setQuestions] = React.useState<UnresolvedQuestion[]>(cloud ? [] : INITIAL_QUESTIONS);
  const [activity, setActivity] = React.useState<ActivityEvent[]>(cloud ? [] : SAMPLE_ACTIVITY);
  const [isDbLoading, setIsDbLoading] = React.useState<boolean>(Boolean(cloud));

  // Modals & Drawers state
  const [inspectingClaim, setInspectingClaim] = React.useState<KnowledgeClaim | null>(null);
  const [inspectingSource, setInspectingSource] = React.useState<Source | null>(null);
  const [reconstructingSource, setReconstructingSource] = React.useState<Source | null>(null);
  const [isReconstructModalOpen, setIsReconstructModalOpen] = React.useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = React.useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState<boolean>(false);
  const [ledgerSourceFilter, setLedgerSourceFilter] = React.useState<string>('all');

  // Load user-uploaded sources, persistent reconstructed claims, and review engine findings from storage on startup
  React.useEffect(() => {
    if (cloud && activeWorkspaceId) {
      let active = true;
      let unsubscribe: (() => void) | undefined;
      setIsDbLoading(true);
      // Clear demo state before the private workspace request resolves. This prevents
      // sample/demo records from flashing in an authenticated team workspace.
      setSources([]); setClaims([]); setConflicts([]); setMissingInfo([]); setQuestions([]); setActivity([]);
      setCurrentWorkspace({
        id: cloud.workspace.id, name: cloud.workspace.name, code: cloud.workspace.code,
        description: cloud.workspace.description, role: cloud.workspace.role,
        projectType: cloud.workspace.projectType, createdAt: new Date().toISOString(),
      });
      const refresh = async () => {
        const data = await loadWorkspaceData(activeWorkspaceId);
        if (!active) return;
        setSources(data.sources); setClaims(data.claims); setConflicts(data.conflicts);
        setMissingInfo(data.missingInfo); setQuestions(data.questions); setActivity(data.activity);
      };
      void refresh().then(() => {
        if (active) unsubscribe = subscribeWorkspaceChanges(activeWorkspaceId, () => { void refresh().catch((e) => console.error('Workspace refresh failed', e)); });
      }).catch((e) => {
        console.error('Workspace cloud load failed:', e);
        if (active) alert('Could not load this workspace. No local demo data was shown. Check your connection and workspace permissions.');
      }).finally(() => { if (active) setIsDbLoading(false); });
      return () => { active = false; unsubscribe?.(); };
    }
    let isMounted = true;

    async function loadStoredData() {
      try {
        const [storedSources, storedClaims, storedConflicts, storedMissing, storedQuestions] = await Promise.all([
          getAllStoredSources(),
          getAllStoredClaims(),
          getAllStoredConflicts(),
          getAllStoredMissingInfo(),
          getAllStoredQuestions(),
        ]);

        console.log(`[DIAGNOSTIC] loadStoredData loaded ${storedClaims.length} stored claims, ${storedConflicts.length} conflicts, ${storedMissing.length} missing info, ${storedQuestions.length} questions.`);

        if (isMounted) {
          if (storedConflicts && storedConflicts.length > 0) {
            setConflicts(storedConflicts);
          } else {
            await saveStoredConflicts(INITIAL_CONFLICTS);
          }
          if (storedMissing && storedMissing.length > 0) {
            setMissingInfo(storedMissing);
          }
          if (storedQuestions && storedQuestions.length > 0) {
            setQuestions(storedQuestions);
          }

          if (storedSources && storedSources.length > 0) {
            // Update claimsCount for sources based on storedClaims
            const sourcesWithCounts = storedSources.map((s) => {
              const matchedClaims = (storedClaims || []).filter((c) => c.sourceId === s.id);
              return {
                ...s,
                claimsCount: matchedClaims.length > 0 ? matchedClaims.length : s.claimsCount,
                reconstructStatus: matchedClaims.length > 0 ? ('completed' as const) : s.reconstructStatus,
              };
            });
            setSources([...sourcesWithCounts, ...INITIAL_SOURCES]);
          }

          if (storedClaims && storedClaims.length > 0) {
            // Merge stored claims with initial demo claims by ID
            const claimMap = new Map<string, KnowledgeClaim>();
            INITIAL_CLAIMS.forEach((c) => claimMap.set(c.id, c));
            storedClaims.forEach((c) => claimMap.set(c.id, c));

            const userClaims = storedClaims.filter((c) => c.isUserExtracted);
            const demoClaims = INITIAL_CLAIMS.map((dc) => claimMap.get(dc.id) || dc);
            const mergedClaims = [...userClaims, ...demoClaims];
            console.log(`[DIAGNOSTIC] Initializing claims state with ${mergedClaims.length} merged claims.`);
            setClaims(mergedClaims);
          }
        }
      } catch (err) {
        console.error('[DIAGNOSTIC] Failed to load user data from storage:', err);
      } finally {
        if (isMounted) {
          setIsDbLoading(false);
        }
      }
    }

    loadStoredData();

    return () => {
      isMounted = false;
    };
  }, [activeWorkspaceId]);

  // Review Engine handlers
  const [isAnalyzingConflicts, setIsAnalyzingConflicts] = React.useState(false);
  const [conflictAnalysisResult, setConflictAnalysisResult] = React.useState<{ analyzed: number; discovered: number; timestamp: string } | null>(null);

  const handleRunConflictAnalysis = async () => {
    setIsAnalyzingConflicts(true);
    try {
      const res = await fetch('/api/gemini/analyze-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Conflict analysis request failed.');
      }

      if (data.success && data.conflicts) {
        // Fetch latest stored conflicts from persistence to avoid stale state
        const storedConflicts = await getAllStoredConflicts();
        const baseConflicts = storedConflicts.length > 0 ? storedConflicts : conflicts;

        const existingMap = new Map<string, ProjectConflict>();
        baseConflicts.forEach(c => {
          if (c.relatedClaimIds && c.relatedClaimIds.length >= 2) {
            const key = c.relatedClaimIds.slice().sort().join('-');
            existingMap.set(key, c);
          } else {
            existingMap.set(c.id, c);
          }
        });

        let newDiscovered = 0;
        for (const aiConf of data.conflicts) {
          const key = aiConf.relatedClaimIds && aiConf.relatedClaimIds.length >= 2
            ? aiConf.relatedClaimIds.slice().sort().join('-')
            : aiConf.id;

          if (existingMap.has(key)) {
            const existing = existingMap.get(key)!;
            // Preserve original ID, review status (resolved/dismissed), notes, and timestamps
            existingMap.set(key, {
              ...aiConf,
              id: existing.id,
              status: existing.status,
              resolvedNote: existing.resolvedNote,
              isAiDetected: existing.isAiDetected ?? true,
              detectedAt: existing.detectedAt || aiConf.detectedAt,
            });
          } else {
            existingMap.set(key, aiConf);
            newDiscovered++;
          }
        }

        const merged = Array.from(existingMap.values());
        setConflicts(merged);
        await saveStoredConflicts(merged);
        setConflictAnalysisResult({
          analyzed: data.analyzedCount,
          discovered: newDiscovered,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      console.error('Conflict analysis failed:', err);
      alert(err.message || 'Failed to run conflict analysis.');
    } finally {
      setIsAnalyzingConflicts(false);
    }
  };

  const handleUpdateConflictStatus = async (conflictId: string, status: ProjectConflict['status'], note?: string) => {
    const updated = conflicts.map(c => c.id === conflictId ? { ...c, status, resolvedNote: note !== undefined ? note : c.resolvedNote } : c);
    setConflicts(updated);
    if (activeWorkspaceId) await saveWorkspaceConflicts(activeWorkspaceId, updated);
    else await saveStoredConflicts(updated);
  };

  const handleUpdateMissingInfoStatus = async (itemId: string, status: MissingInfoFinding['status']) => {
    const updated = missingInfo.map(m => m.id === itemId ? { ...m, status } : m);
    setMissingInfo(updated);
    if (activeWorkspaceId) await saveWorkspaceMissingInfo(activeWorkspaceId, updated);
    else await saveStoredMissingInfo(updated);
  };

  const handleUpdateQuestion = async (qId: string, status: UnresolvedQuestion['status'], answer?: string) => {
    const updated = questions.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          status,
          answer: answer !== undefined ? answer : q.answer,
          answeredBy: answer ? activeActor : q.answeredBy,
          answeredAt: answer ? 'Just now' : q.answeredAt,
        };
      }
      return q;
    });
    setQuestions(updated);
    if (activeWorkspaceId) await saveWorkspaceQuestions(activeWorkspaceId, updated);
    else await saveStoredQuestions(updated);
  };

  // Status counters
  const unverifiedCount = claims.filter((c) => c.verificationStatus === 'unverified').length;
  const conflictedCount = claims.filter((c) => c.verificationStatus === 'conflicted').length;

  // Handle updating a claim's status in memory and IndexedDB/localStorage
  const handleUpdateClaimStatus = async (
    claimId: string,
    newStatus: VerificationStatus,
    note?: string
  ) => {
    const target = claims.find((c) => c.id === claimId);
    if (!target) {
      console.error(`[DIAGNOSTIC] Claim not found for id: ${claimId}`);
      return;
    }

    const updatedClaim: KnowledgeClaim = {
      ...target,
      verificationStatus: newStatus,
      humanReviewNotes: note !== undefined ? note : target.humanReviewNotes,
      lastReviewedBy: activeActor,
      lastReviewedAt: 'Just now',
    };

    console.log(`[DIAGNOSTIC] handleUpdateClaimStatus updating claim ${claimId}:`, {
      from: target.verificationStatus,
      to: newStatus,
      updatedClaim,
    });

    // 1. Immediately update interface state
    setClaims((prev) => prev.map((c) => (c.id === claimId ? updatedClaim : c)));

    // 2. Update inspecting claim if open
    if (inspectingClaim?.id === claimId) {
      setInspectingClaim(updatedClaim);
    }

    // 3. Persist to storage (IndexedDB + localStorage) with diagnostics
    try {
      if (activeWorkspaceId) await updateWorkspaceClaim(activeWorkspaceId, updatedClaim);
      else await saveStoredClaims([updatedClaim]);
      console.log(`[DIAGNOSTIC] Successfully saved updated claim ${claimId} co-persisted.`);
    } catch (err) {
      console.error(`[DIAGNOSTIC] FAILED to persist updated claim ${claimId}:`, err);
      throw err;
    }

    // 4. Record activity event
    const eventType =
      newStatus === 'verified'
        ? 'claim_verified'
        : newStatus === 'rejected'
        ? 'claim_rejected'
        : 'conflict_detected';

    const newActivity: ActivityEvent = {
      id: `act-${Date.now()}`,
      type: eventType,
      timestamp: 'Just now',
      title: `Claim #${claimId} ${newStatus === 'verified' ? 'Verified & Approved' : newStatus === 'rejected' ? 'Rejected' : 'Flagged Uncertain'}`,
      description: target.statement,
      actor: activeActor,
      claimId,
    };

    setActivity((prev) => [newActivity, ...prev]);
    if (activeWorkspaceId) void appendWorkspaceActivity(activeWorkspaceId, newActivity).catch((e) => alert('Activity could not be synchronized: ' + e.message));
  };

  // Handle toggling persistent flag state on a claim
  const handleToggleFlagClaim = async (claimId: string) => {
    const target = claims.find((c) => c.id === claimId);
    if (!target) return;

    const newFlagState = !target.isFlagged;
    const updatedClaim: KnowledgeClaim = {
      ...target,
      isFlagged: newFlagState,
      flaggedAt: newFlagState ? new Date().toISOString() : undefined,
      flaggedBy: newFlagState ? 'Elena Rostova (Lead Architect)' : undefined,
    };

    // 1. Immediately update interface state
    setClaims((prev) => prev.map((c) => (c.id === claimId ? updatedClaim : c)));

    // 2. Update inspecting claim if open
    if (inspectingClaim?.id === claimId) {
      setInspectingClaim(updatedClaim);
    }

    // 3. Persist to IndexedDB so it survives page refresh
    try {
      if (activeWorkspaceId) await saveWorkspaceClaims(activeWorkspaceId, [updatedClaim]);
      else await saveStoredClaims([updatedClaim]);
    } catch (err) {
      console.warn('Failed to persist flagged claim:', err);
    }

    // 4. Record Activity event
    const newAct: ActivityEvent = {
      id: `act-${Date.now()}`,
      type: newFlagState ? 'claim_flagged' : 'claim_unflagged',
      timestamp: 'Just now',
      title: newFlagState ? `Claim #${claimId} Flagged for Review` : `Flag Removed from Claim #${claimId}`,
      description: updatedClaim.statement,
      actor: 'Elena Rostova',
      claimId,
      sourceId: updatedClaim.sourceId,
    };
    setActivity((prev) => [newAct, ...prev]);
    if (activeWorkspaceId) void appendWorkspaceActivity(activeWorkspaceId, newAct).catch((e) => alert('Activity could not be synchronized: ' + e.message));
  };

  // Handle adding a newly ingested source (from upload or connector)
  const handleAddSource = (newSource: Source) => {
    setSources((prev) => [newSource, ...prev.filter((s) => s.id !== newSource.id)]);

    const newAct: ActivityEvent = {
      id: `act-${Date.now()}`,
      type: 'source_ingested',
      timestamp: 'Just now',
      title: `Source Ingested: ${newSource.title}`,
      description: newSource.isUserUploaded
        ? `Extracted ${(newSource.charCount || 0).toLocaleString()} characters from ${newSource.filename} (persisted in IndexedDB).`
        : `Attached demo repository ${newSource.filename}.`,
      actor: newSource.isUserUploaded ? 'You (Active Session)' : 'Elena Rostova',
      sourceId: newSource.id,
    };
    setActivity((prev) => [newAct, ...prev]);
    if (activeWorkspaceId) void appendWorkspaceActivity(activeWorkspaceId, newAct).catch((e) => alert('Source activity could not be synchronized: ' + e.message));
  };

  // Handle opening Reconstruct modal for a given source
  const handleOpenReconstructModal = (source: Source) => {
    setReconstructingSource(source);
    setIsReconstructModalOpen(true);
  };

  // Handle knowledge claims reconstructed by Gemini
  const handleClaimsExtracted = async (
    sourceId: string,
    newClaims: KnowledgeClaim[],
    updatedSource: Source
  ) => {
    // 1. Update sources state
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? updatedSource : s))
    );

    // 2. Remove old claims for this source and prepend new claims
    setClaims((prev) => [
      ...newClaims,
      ...prev.filter((c) => c.sourceId !== sourceId),
    ]);

    // 3. Record Activity event
    const newAct: ActivityEvent = {
      id: `act-${Date.now()}`,
      type: 'knowledge_reconstructed',
      timestamp: 'Just now',
      title: `Knowledge Reconstructed: ${updatedSource.title}`,
      description: `Synthesized ${newClaims.length} atomic claims with Gemini 3.8 Flash (${newClaims.filter((c) => c.evidenceGrounded).length} grounded to verbatim citations). Stored in IndexedDB.`,
      actor: 'Gemini 3.8 Flash',
      sourceId,
    };
    setActivity((prev) => [newAct, ...prev]);
    if (activeWorkspaceId) {
      try {
        await saveWorkspaceSource(activeWorkspaceId, updatedSource);
        await saveWorkspaceClaims(activeWorkspaceId, newClaims);
        await appendWorkspaceActivity(activeWorkspaceId, newAct);
      } catch (e) {
        alert('Reconstructed knowledge could not be saved to the workspace: ' + (e instanceof Error ? e.message : 'unknown error'));
      }
    }
  };

  const handleSyncGitHubSource = async (source: Source) => {
    if (source.type !== 'github' || !source.githubUrl) return;
    try {
      const snapshot = await fetchPublicGitHubSnapshot(source.githubUrl, source.repoBranch || '');
      const file = new globalThis.File([snapshot.snapshot], `${snapshot.repo}-${snapshot.branch}-snapshot.md`, { type: 'text/markdown' });
      const hash = await (await import('./services/extractor')).computeFileHash(file);
      const updatedSource: Source = {
        ...source, title: source.title || `${snapshot.owner}/${snapshot.repo}`,
        filename: `${snapshot.owner}/${snapshot.repo}@${snapshot.branch}`,
        repoBranch: snapshot.branch, githubOwner: snapshot.owner, githubRepo: snapshot.repo,
        githubUrl: snapshot.url, commitSha: snapshot.commitSha, lastSyncedAt: new Date().toISOString(),
        size: `${(file.size / 1024).toFixed(1)} KB`, sizeBytes: file.size,
        ingestedAt: 'Just now', timestamp: Date.now(), extractedText: snapshot.snapshot,
        rawExcerpt: snapshot.snapshot.slice(0, 300), charCount: snapshot.snapshot.length,
        wordCount: snapshot.snapshot.trim().split(/\\s+/).length, contentHash: hash,
        summary: `${snapshot.description} Synced ${snapshot.filesIncluded} documentation files at commit ${snapshot.commitSha.slice(0, 12)}.`,
        tags: ['GitHub', 'Public Repository', 'Documentation Snapshot'],
      };
      if (activeWorkspaceId) {
        await uploadWorkspaceSourceFile(activeWorkspaceId, updatedSource, file, false);
        await saveWorkspaceSource(activeWorkspaceId, updatedSource);
      } else {
        const { saveStoredSource, saveStoredFile } = await import('./services/db');
        await saveStoredSource(updatedSource);
        await saveStoredFile(updatedSource.id, file);
      }
      setSources((previous) => previous.map((item) => item.id === source.id ? updatedSource : item));
      const event: ActivityEvent = {
        id: `act-${Date.now()}`, type: 'github_synced', timestamp: 'Just now',
        title: `GitHub snapshot synced: ${snapshot.owner}/${snapshot.repo}`,
        description: `Updated documentation snapshot to commit ${snapshot.commitSha.slice(0, 12)}.`,
        actor: activeActor, sourceId: source.id,
      };
      setActivity((previous) => [event, ...previous]);
      if (activeWorkspaceId) await appendWorkspaceActivity(activeWorkspaceId, event);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'GitHub synchronization failed.');
      throw error;
    }
  };

  // Handle deleting a source (cascades deletion of claims)
  const handleDeleteSource = async (sourceId: string) => {
    const target = sources.find((s) => s.id === sourceId);

    // Delete only within the active persistence boundary.
    try {
      if (activeWorkspaceId) await deleteWorkspaceSource(activeWorkspaceId, sourceId);
      else await deleteStoredSource(sourceId);
    } catch (err) {
      console.error('Error deleting source from workspace persistence:', err);
      throw err;
    }

    // Only update in-memory state after persistent deletion succeeds.
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
    setClaims((prev) => prev.filter((c) => c.sourceId !== sourceId));

    if (inspectingSource?.id === sourceId) {
      setInspectingSource(null);
    }
    if (reconstructingSource?.id === sourceId) {
      setReconstructingSource(null);
      setIsReconstructModalOpen(false);
    }

    if (target) {
      const deleteAct: ActivityEvent = {
        id: `act-${Date.now()}`,
        type: 'source_ingested',
        timestamp: 'Just now',
        title: `Source Removed: ${target.title}`,
        description: `Deleted ${target.filename} and all associated knowledge claims from workspace and local IndexedDB.`,
        actor: 'You (Active Session)',
      };
      setActivity((prev) => [deleteAct, ...prev]);
    }
  };

  // Reset only the isolated Judge Demo namespace and restore the original sample state.
  const handleResetSampleData = async () => {
    if (activeWorkspaceId) {
      alert('Sample data reset is disabled in authenticated workspaces. Your shared team data has not been changed.');
      return;
    }

    try {
      await clearJudgeDemoPersistence();
      setSources(INITIAL_SOURCES);
      setClaims(INITIAL_CLAIMS);
      setConflicts(INITIAL_CONFLICTS);
      setMissingInfo(INITIAL_MISSING_INFO);
      setQuestions(INITIAL_QUESTIONS);
      setActivity(SAMPLE_ACTIVITY);
      setInspectingClaim(null);
      setInspectingSource(null);
      setReconstructingSource(null);
      setIsReconstructModalOpen(false);
      setIsConnectModalOpen(false);
      setLedgerSourceFilter('all');
      alert('Judge Demo sample data has been restored. Your normal ProjectVault workspace data was not changed.');
    } catch (error) {
      console.error('Judge Demo reset failed:', error);
      alert('Judge Demo could not be reset. No success was reported; please retry after checking browser storage permissions.');
    }
  };

  // Header primary action router
  const handlePrimaryAction = () => {
    switch (currentPage) {
      case 'overview':
      case 'sources':
        setIsConnectModalOpen(true);
        break;
      case 'ledger':
        setCurrentPage('review');
        break;
      case 'review':
        // Jump to first conflicted claim
        const firstConflict = claims.find((c) => c.verificationStatus === 'conflicted');
        if (firstConflict) setInspectingClaim(firstConflict);
        break;
      case 'handover':
        // Trigger export action or scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'graph':
        setIsConnectModalOpen(true);
        break;
      case 'settings':
        alert('Settings configuration saved for active session.');
        break;
    }
  };

  // Navigate to Ledger filtered by a specific source
  const handleNavigateToLedgerFiltered = (sourceId?: string) => {
    if (sourceId) {
      setLedgerSourceFilter(sourceId);
    } else {
      setLedgerSourceFilter('all');
    }
    setCurrentPage('ledger');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FBFBFE] dark:bg-[#111033] text-neutral-900 dark:text-[#FFF4E3] flex font-sans transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        workspaces={activeWorkspaceId ? [currentWorkspace] : SAMPLE_WORKSPACES}
        currentWorkspace={currentWorkspace}
        isDemoWorkspace={!cloud}
        activeActor={activeActor}
        onSelectWorkspace={(ws) => setCurrentWorkspace(ws)}
        unverifiedCount={unverifiedCount}
        conflictedCount={conflictedCount}
        sourcesCount={sources.length}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Header
          currentPage={currentPage}
          currentWorkspace={currentWorkspace}
          isDemoWorkspace={!cloud}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onPrimaryAction={handlePrimaryAction}
          onNavigate={(page) => setCurrentPage(page)}
        />

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'overview' && (
            <OverviewPage
              currentWorkspace={currentWorkspace}
              isDemoWorkspace={!cloud}
              workflowStages={WORKFLOW_STAGES}
              sources={sources}
              claims={claims}
              activity={activity}
              onNavigate={(page) => setCurrentPage(page)}
              onInspectClaim={(claim) => setInspectingClaim(claim)}
              onOpenConnectModal={() => setIsConnectModalOpen(true)}
            />
          )}

          {currentPage === 'sources' && (
            <SourcesPage
              sources={sources}
              onOpenSourceDetail={(source) => setInspectingSource(source)}
              onOpenConnectModal={() => setIsConnectModalOpen(true)}
              onSourceAdded={handleAddSource}
              onSourceDeleted={handleDeleteSource}
              onReconstructSource={handleOpenReconstructModal}
              onNavigateToLedger={handleNavigateToLedgerFiltered}
              isLoading={isDbLoading}
            />
          )}

          {currentPage === 'ledger' && (
            <KnowledgeLedgerPage
              claims={claims}
              sources={sources}
              initialSourceFilter={ledgerSourceFilter}
              onInspectClaim={(claim) => setInspectingClaim(claim)}
              onNavigateToReview={() => setCurrentPage('review')}
              onNavigateToSources={() => setCurrentPage('sources')}
              onToggleFlagClaim={handleToggleFlagClaim}
            />
          )}

          {currentPage === 'graph' && (
            <KnowledgeGraphPage
              sources={sources}
              claims={claims}
              conflicts={conflicts}
              onInspectClaim={(claim) => setInspectingClaim(claim)}
            />
          )}

          {currentPage === 'review' && (
            <ReviewPage
              claims={claims}
              conflicts={conflicts}
              missingInfo={missingInfo}
              questions={questions}
              isAnalyzingConflicts={isAnalyzingConflicts}
              conflictAnalysisResult={conflictAnalysisResult}
              onRunConflictAnalysis={handleRunConflictAnalysis}
              onUpdateClaimStatus={handleUpdateClaimStatus}
              onToggleFlagClaim={handleToggleFlagClaim}
              onUpdateConflictStatus={handleUpdateConflictStatus}
              onUpdateMissingInfoStatus={handleUpdateMissingInfoStatus}
              onUpdateQuestion={handleUpdateQuestion}
              onNavigateToSources={(sourceId) => {
                if (sourceId) {
                  const src = sources.find((s) => s.id === sourceId);
                  if (src) setInspectingSource(src);
                } else {
                  setCurrentPage('sources');
                }
              }}
            />
          )}

          {currentPage === 'handover' && (
            <HandoverPage
              currentWorkspace={currentWorkspace}
              claims={claims}
              sources={sources}
              conflicts={conflicts}
              missingInfo={missingInfo}
              questions={questions}
              onNavigateToReview={() => setCurrentPage('review')}
              onNavigateToLedger={() => setCurrentPage('ledger')}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage
              currentWorkspace={currentWorkspace}
              onResetSampleData={handleResetSampleData}
            />
          )}
        </main>
      </div>

      {/* Deep Claim Evidence Inspector Modal */}
      <ClaimModal
        claim={inspectingClaim}
        onClose={() => setInspectingClaim(null)}
        onUpdateStatus={handleUpdateClaimStatus}
        onToggleFlag={handleToggleFlagClaim}
        onNavigateToSource={(sourceId) => {
          const src = sources.find((s) => s.id === sourceId);
          if (src) setInspectingSource(src);
        }}
      />

      {/* Deep Source Artifact Detail Modal */}
      <SourceDetailModal
        source={inspectingSource}
        claims={claims}
        onClose={() => setInspectingSource(null)}
        onInspectClaim={(claim) => setInspectingClaim(claim)}
        onNavigateToLedger={() => handleNavigateToLedgerFiltered(inspectingSource?.id)}
        onDeleteSource={handleDeleteSource}
        onReconstructSource={handleOpenReconstructModal}
        onSyncGitHubSource={handleSyncGitHubSource}
      />

      {/* Reconstruct Knowledge Modal (Gemini 3.8 Flash) */}
      <ReconstructModal
        source={reconstructingSource}
        isOpen={isReconstructModalOpen}
        onClose={() => {
          setIsReconstructModalOpen(false);
          setReconstructingSource(null);
        }}
        onClaimsExtracted={handleClaimsExtracted}
        onNavigateToLedger={handleNavigateToLedgerFiltered}
        onInspectClaim={(claim) => setInspectingClaim(claim)}
      />

      {/* Connect Project Source Modal */}
      <ConnectSourceModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onAddSource={handleAddSource}
      />
    </div>
  );
}
