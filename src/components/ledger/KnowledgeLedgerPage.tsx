/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  KnowledgeClaim,
  ClaimCategory,
  VerificationStatus,
  ConfidenceTier,
  Source,
} from '../../types';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ShieldCheck,
  FileText,
  Eye,
  SlidersHorizontal,
  ArrowUpDown,
  BookOpen,
  Sparkles,
  Quote,
  Layers,
  FileCheck,
  Cpu,
} from 'lucide-react';
import { EmptyVault3D } from '../common/Soft3DVisuals';

interface KnowledgeLedgerPageProps {
  claims: KnowledgeClaim[];
  sources?: Source[];
  initialSourceFilter?: string;
  onInspectClaim: (claim: KnowledgeClaim) => void;
  onNavigateToReview: () => void;
  onNavigateToSources?: () => void;
  onToggleFlagClaim?: (claimId: string) => void;
}

export const KnowledgeLedgerPage: React.FC<KnowledgeLedgerPageProps> = ({
  claims,
  sources = [],
  initialSourceFilter = 'all',
  onInspectClaim,
  onNavigateToReview,
  onNavigateToSources,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [selectedTier, setSelectedTier] = React.useState<string>('all');
  const [selectedSource, setSelectedSource] = React.useState<string>(initialSourceFilter);
  const [selectedOrigin, setSelectedOrigin] = React.useState<'all' | 'extracted' | 'demo'>('all');
  const [sortBy, setSortBy] = React.useState<'confidence' | 'id' | 'importance'>('confidence');

  React.useEffect(() => {
    if (initialSourceFilter && initialSourceFilter !== 'all') {
      setSelectedSource(initialSourceFilter);
    }
  }, [initialSourceFilter]);

  // Derive unique sources from claims
  const sourceOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of claims) {
      if (c.sourceId && c.sourceName) {
        map.set(c.sourceId, c.sourceName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [claims]);

  // Real extracted vs demo claims breakdown
  const realExtractedClaimsCount = claims.filter((c) => c.isUserExtracted).length;
  const demoClaimsCount = claims.length - realExtractedClaimsCount;

  // Active categories present in claims
  const availableCategories = React.useMemo(() => {
    const set = new Set<string>();
    claims.forEach((c) => set.add(c.category));
    return Array.from(set).sort();
  }, [claims]);

  const filteredClaims = claims
    .filter((claim) => {
      const matchesSearch =
        claim.statement.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.sourceLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (claim.sourceEvidenceQuote && claim.sourceEvidenceQuote.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'all' || claim.category === selectedCategory;

      const matchesStatus =
        selectedStatus === 'all' || claim.verificationStatus === selectedStatus;

      const matchesTier =
        selectedTier === 'all' || claim.confidenceTier === selectedTier;

      const matchesSource =
        selectedSource === 'all' || claim.sourceId === selectedSource;

      const matchesOrigin =
        selectedOrigin === 'all' ||
        (selectedOrigin === 'extracted' && claim.isUserExtracted) ||
        (selectedOrigin === 'demo' && !claim.isUserExtracted);

      return matchesSearch && matchesCategory && matchesStatus && matchesTier && matchesSource && matchesOrigin;
    })
    .sort((a, b) => {
      if (sortBy === 'confidence') return b.confidenceScore - a.confidenceScore;
      if (sortBy === 'id') return a.id.localeCompare(b.id);
      if (sortBy === 'importance') {
        const order = { critical: 3, high: 2, standard: 1 };
        return order[b.importance] - order[a.importance];
      }
      return 0;
    });

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Verified
          </span>
        );
      case 'conflicted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F36B3F] bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/40 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-[#F36B3F]" />
            Conflicted
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40 whitespace-nowrap">
            <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Unverified
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/40 whitespace-nowrap">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Rejected
          </span>
        );
    }
  };

  const getConfidenceBar = (score: number) => {
    let color = 'bg-[#55C7C2]';
    if (score < 65) color = 'bg-[#F36B3F]';
    else if (score < 80) color = 'bg-[#E5B25D]';

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-neutral-200 dark:bg-[#14133B] rounded-full overflow-hidden">
          <div
            className={`h-full ${color} rounded-full`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="font-mono text-xs font-semibold tabular-nums text-neutral-800 dark:text-[#FFF4E3]">
          {score}%
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Stage 3 Indicator & Demo/Real Transparency */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-6 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 bg-[#25245F] dark:bg-[#2D2B75] text-white rounded border border-[#25245F] dark:border-[#55C7C2]/40">
                Stage 3 / 5 · VERIFY
              </span>
              {realExtractedClaimsCount > 0 ? (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 rounded border border-purple-300 dark:border-purple-700/50 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#F36B3F]" />
                  {realExtractedClaimsCount} GEMINI RECONSTRUCTED
                </span>
              ) : null}
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FFF4E3] dark:bg-[#25245F]/70 text-[#25245F] dark:text-[#55C7C2] rounded border border-[#E5B25D]/60 dark:border-[#55C7C2]/30 font-semibold">
                {demoClaimsCount} DEMO BASELINE
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">·</span>
              <span className="text-xs text-neutral-500 dark:text-[#8E8DAF] font-mono">
                {claims.length} total atomic claims recorded
              </span>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-[#FFF4E3] mt-1">
              Verifiable System Knowledge & Evidence Audit
            </h2>
            <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] max-w-2xl leading-relaxed">
              Every row represents an extracted institutional fact or design contract. Claims are anchored directly to source documents with calculated confidence scores and verbatim citation locators. All newly extracted AI claims are classified as <strong className="font-semibold text-amber-700 dark:text-amber-300">UNVERIFIED</strong> until human signoff.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToSources && (
              <button
                onClick={onNavigateToSources}
                className="px-3 py-2 text-xs font-bold text-[#25245F] dark:text-[#FFF4E3] bg-neutral-100 dark:bg-[#25245F] hover:bg-neutral-200 dark:hover:bg-[#2D2B75] rounded-lg border-2 border-neutral-300 dark:border-[#35337C] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Manage Sources</span>
              </button>
            )}

            <button
              onClick={onNavigateToReview}
              className="px-4 py-2 text-xs font-bold text-white bg-[#F36B3F] hover:bg-[#E0572C] rounded-lg border-2 border-[#F36B3F] shadow-[3px_3px_0px_#25245F] dark:shadow-[3px_3px_0px_#55C7C2] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Review Conflicts & Signoffs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-4 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-3 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 dark:text-[#8E8DAF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search claims, IDs, keywords, quotes, or source files..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#35337C] text-neutral-900 dark:text-[#FFF4E3] placeholder-neutral-400 dark:placeholder-[#8E8DAF] rounded-lg focus:outline-none focus:border-[#25245F] dark:focus:border-[#55C7C2] focus:bg-white dark:focus:bg-[#14133B] transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Origin Filter (All / Gemini Reconstructed / Demo) */}
            <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-[#14133B] rounded-lg text-xs border border-neutral-300 dark:border-[#2D2C68]">
              {[
                { id: 'all', label: `All (${claims.length})` },
                { id: 'extracted', label: `Gemini (${realExtractedClaimsCount})` },
                { id: 'demo', label: `Demo (${demoClaimsCount})` },
              ].map((orig) => (
                <button
                  key={orig.id}
                  onClick={() => setSelectedOrigin(orig.id as any)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    selectedOrigin === orig.id
                      ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                      : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {orig.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-[#14133B] rounded-lg text-xs border border-neutral-300 dark:border-[#2D2C68]">
              {[
                { id: 'all', label: 'All Status' },
                { id: 'verified', label: 'Verified' },
                { id: 'conflicted', label: 'Conflicted' },
                { id: 'unverified', label: 'Unverified' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStatus(st.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    selectedStatus === st.id
                      ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] shadow-xs font-bold'
                      : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Source Document Dropdown */}
            {sourceOptions.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="text-xs bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#2D2C68] rounded-lg px-2.5 py-1.5 text-neutral-800 dark:text-[#FFF4E3] font-medium focus:outline-none max-w-[180px] truncate"
                >
                  <option value="all" className="dark:bg-[#14133B]">All Sources ({sourceOptions.length})</option>
                  {sourceOptions.map((s) => (
                    <option key={s.id} value={s.id} className="dark:bg-[#14133B] truncate">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Selector */}
            <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-[#C4C3E0]">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 dark:text-[#8E8DAF]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-neutral-50 dark:bg-[#14133B] border-2 border-neutral-300 dark:border-[#2D2C68] rounded-lg px-2 py-1.5 text-neutral-800 dark:text-[#FFF4E3] font-medium focus:outline-none"
              >
                <option value="confidence" className="dark:bg-[#14133B]">Confidence Score</option>
                <option value="importance" className="dark:bg-[#14133B]">Priority / Impact</option>
                <option value="id" className="dark:bg-[#14133B]">Claim ID</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-[#2D2C68] text-xs">
          <span className="text-neutral-400 dark:text-[#8E8DAF] text-[11px] uppercase font-bold mr-1">Category:</span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#25245F] dark:bg-[#2D2B75] text-white font-bold border border-[#25245F]'
                : 'text-neutral-600 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F]'
            }`}
          >
            All Categories
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#25245F] dark:bg-[#2D2B75] text-white font-bold border border-[#25245F]'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F]'
              }`}
            >
              {cat}
            </button>
          ))}

          <span className="text-neutral-300 dark:text-neutral-600 mx-1">|</span>

          <span className="text-neutral-400 dark:text-[#8E8DAF] text-[11px] uppercase font-bold">Confidence Tier:</span>
          {['all', 'high', 'moderate', 'low'].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-2 py-0.5 rounded text-xs capitalize transition-colors cursor-pointer ${
                selectedTier === tier
                  ? 'bg-neutral-800 dark:bg-[#55C7C2] text-white dark:text-[#111033] font-bold'
                  : 'text-neutral-600 dark:text-[#C4C3E0] hover:bg-neutral-100 dark:hover:bg-[#25245F]'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm overflow-hidden transition-colors">
        {filteredClaims.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <EmptyVault3D message="No matching knowledge claims found" />
            <p className="text-xs text-neutral-500 dark:text-[#8E8DAF] max-w-sm mx-auto">
              Try adjusting your category, status, origin, or source filters to view claims.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSelectedTier('all');
                setSelectedSource('all');
                setSelectedOrigin('all');
              }}
              className="px-3.5 py-1.5 text-xs font-bold text-[#25245F] dark:text-[#55C7C2] bg-neutral-100 dark:bg-[#25245F] hover:bg-neutral-200 dark:hover:bg-[#2D2B75] rounded-lg border border-neutral-300 dark:border-[#35337C] transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-[#14133B] border-b-2 border-neutral-200 dark:border-[#2D2C68] text-neutral-500 dark:text-[#8E8DAF] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-28">ID & Origin</th>
                  <th className="py-3 px-4">Knowledge Statement & Verbatim Evidence</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-4">Source Provenance</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3">Verification</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-[#2D2C68]">
                {filteredClaims.map((claim) => (
                  <tr
                    key={claim.id}
                    onClick={() => onInspectClaim(claim)}
                    className="hover:bg-neutral-50 dark:hover:bg-[#222158]/50 cursor-pointer transition-colors group"
                  >
                    {/* ID & Origin Badge */}
                    <td className="py-3.5 px-3 align-top whitespace-nowrap">
                      <div className="space-y-1">
                        <span className="font-mono font-bold text-neutral-800 dark:text-[#C4C3E0] group-hover:text-[#F36B3F] transition-colors block">
                          {claim.id}
                        </span>
                        {claim.isUserExtracted ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                            <Sparkles className="w-2.5 h-2.5 text-[#F36B3F]" />
                            GEMINI
                          </span>
                        ) : (
                          <span className="inline-block text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-[#14133B] text-neutral-500 dark:text-[#8E8DAF] border border-neutral-200 dark:border-[#2D2C68]">
                            DEMO
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Statement & Verbatim Evidence Quote */}
                    <td className="py-3.5 px-4 max-w-lg align-top">
                      <div className="space-y-1.5">
                        <p className="text-neutral-900 dark:text-[#FFF4E3] font-medium group-hover:text-[#25245F] dark:group-hover:text-[#55C7C2] transition-colors leading-relaxed">
                          {claim.statement}
                        </p>

                        {claim.sourceEvidenceQuote && (
                          <div className="text-[11px] text-neutral-600 dark:text-[#C4C3E0] bg-neutral-50 dark:bg-[#14133B] p-2 rounded border border-neutral-200 dark:border-[#2D2C68] font-serif italic flex items-start gap-1.5">
                            <Quote className="w-3 h-3 text-neutral-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">"{claim.sourceEvidenceQuote}"</span>
                          </div>
                        )}

                        {claim.conflictingEvidence && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#F36B3F] font-semibold bg-orange-50 dark:bg-orange-950/30 p-1.5 rounded border border-orange-200 dark:border-orange-900/40">
                            <AlertTriangle className="w-3 h-3 shrink-0 text-[#F36B3F]" />
                            <span className="truncate">Contradiction: {claim.conflictingEvidence.conflictReason}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-3 align-top whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-[#25245F] text-neutral-700 dark:text-[#FFF4E3] border border-neutral-200 dark:border-[#35337C]">
                        {claim.category}
                      </span>
                    </td>

                    {/* Source Provenance & Locators */}
                    <td className="py-3.5 px-4 max-w-xs align-top">
                      <div className="space-y-0.5">
                        <div className="text-neutral-900 dark:text-[#FFF4E3] font-medium truncate flex items-center gap-1">
                          <FileText className="w-3 h-3 text-neutral-400 dark:text-[#8E8DAF] shrink-0" />
                          <span className="truncate">{claim.sourceName}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-[#8E8DAF] font-mono truncate">
                          {claim.sourceLocation}
                        </div>
                        {claim.pageNumber && (
                          <div className="text-[10px] text-[#55C7C2] font-mono">
                            Page {claim.pageNumber}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Confidence Meter */}
                    <td className="py-3.5 px-3 align-top whitespace-nowrap">
                      <div className="space-y-1">
                        {getConfidenceBar(claim.confidenceScore)}
                        <span className="text-[10px] capitalize text-neutral-400 dark:text-[#8E8DAF] block">
                          {claim.confidenceTier} evidence
                        </span>
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td className="py-3.5 px-3 align-top whitespace-nowrap">
                      {getStatusBadge(claim.verificationStatus)}
                    </td>

                    {/* Inspect Action */}
                    <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectClaim(claim);
                        }}
                        className="p-1.5 text-neutral-400 dark:text-[#8E8DAF] hover:text-[#25245F] dark:hover:text-[#FFF4E3] rounded-md hover:bg-neutral-100 dark:hover:bg-[#25245F] transition-colors inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                        title="Audit source citation and evidence anchor"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Trace</span>
                      </button>
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
