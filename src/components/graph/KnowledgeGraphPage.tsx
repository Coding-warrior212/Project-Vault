import React from 'react';
import type { KnowledgeClaim, ProjectConflict, Source } from '../../types';

type Props = {
  sources: Source[];
  claims: KnowledgeClaim[];
  conflicts: ProjectConflict[];
  onInspectClaim: (claim: KnowledgeClaim) => void;
};

export const KnowledgeGraphPage: React.FC<Props> = ({ sources, claims, conflicts, onInspectClaim }) => {
  const [selectedSourceId, setSelectedSourceId] = React.useState<string | null>(sources[0]?.id ?? null);
  React.useEffect(() => {
    if (!selectedSourceId || !sources.some((source) => source.id === selectedSourceId)) {
      setSelectedSourceId(sources[0]?.id ?? null);
    }
  }, [sources, selectedSourceId]);

  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? null;
  const relatedClaims = selectedSource ? claims.filter((claim) => claim.sourceId === selectedSource.id) : [];
  const relatedIds = new Set(relatedClaims.map((claim) => claim.id));
  const impactedConflicts = conflicts.filter((conflict) =>
    conflict.status === 'open' && conflict.relatedClaimIds.some((id) => relatedIds.has(id))
  );
  const verified = relatedClaims.filter((claim) => claim.verificationStatus === 'verified').length;
  const unverified = relatedClaims.filter((claim) => claim.verificationStatus === 'unverified').length;
  const flagged = relatedClaims.filter((claim) => claim.isFlagged).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-[#25245F] bg-[#25245F] p-6 text-white shadow-[4px_4px_0px_#55C7C2]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#55C7C2]">Knowledge Graph · Change Impact</p>
        <h2 className="mt-2 text-2xl font-bold">See how project knowledge connects</h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-white/75">Explore source-to-claim evidence links, review state, and the open conflicts that could be affected when a source changes.</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="text-[10px] uppercase text-white/60">Sources</p><p className="mt-1 text-2xl font-bold tabular-nums">{sources.length}</p></div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="text-[10px] uppercase text-white/60">Evidence claims</p><p className="mt-1 text-2xl font-bold tabular-nums">{claims.length}</p></div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="text-[10px] uppercase text-white/60">Open conflicts</p><p className="mt-1 text-2xl font-bold tabular-nums">{conflicts.filter((item) => item.status === 'open').length}</p></div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.5fr)]">
        <section className="rounded-xl border-2 border-neutral-200 bg-white p-4 dark:border-[#2D2C68] dark:bg-[#1B1A48]">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-neutral-900 dark:text-[#FFF4E3]">Source nodes</h3><span className="text-[10px] text-neutral-500">Select to trace impact</span></div>
          <div className="space-y-2">
            {sources.map((source) => {
              const count = claims.filter((claim) => claim.sourceId === source.id).length;
              const active = source.id === selectedSourceId;
              return <button key={source.id} type="button" onClick={() => setSelectedSourceId(source.id)} className={`w-full rounded-lg border p-3 text-left transition ${active ? 'border-[#55C7C2] bg-[#55C7C2]/10 ring-1 ring-[#55C7C2]' : 'border-neutral-200 hover:border-neutral-400 dark:border-[#35337C] dark:hover:border-[#55C7C2]/50'}`}>
                <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-xs font-bold text-neutral-900 dark:text-[#FFF4E3]">{source.title}</span><span className="mt-1 block truncate text-[10px] text-neutral-500">{source.filename}</span></span><span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-700 dark:bg-[#25245F] dark:text-[#55C7C2]">{count} links</span></span>
              </button>;
            })}
            {sources.length === 0 && <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-xs text-neutral-500">No source nodes yet. Connect a document to begin building the knowledge graph.</p>}
          </div>
        </section>

        <section className="rounded-xl border-2 border-neutral-200 bg-white p-4 dark:border-[#2D2C68] dark:bg-[#1B1A48]">
          {selectedSource ? <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-[#2D2C68]">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#F36B3F]">Selected source node</p><h3 className="mt-1 text-base font-bold text-neutral-900 dark:text-[#FFF4E3]">{selectedSource.title}</h3><p className="mt-1 text-[11px] text-neutral-500">{selectedSource.type.toUpperCase()} · {selectedSource.ingestedAt}</p></div>
              <span className="rounded-full bg-[#55C7C2]/15 px-3 py-1 text-[10px] font-bold text-teal-800 dark:text-[#55C7C2]">{relatedClaims.length} evidence links</span>
            </div>
            <div className="my-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/20"><p className="text-[9px] uppercase text-emerald-700 dark:text-emerald-300">Verified</p><p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{verified}</p></div>
              <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/20"><p className="text-[9px] uppercase text-amber-700 dark:text-amber-300">Unverified</p><p className="text-xl font-bold text-amber-800 dark:text-amber-300">{unverified}</p></div>
              <div className="rounded-lg bg-rose-50 p-2 dark:bg-rose-950/20"><p className="text-[9px] uppercase text-rose-700 dark:text-rose-300">Flagged</p><p className="text-xl font-bold text-rose-800 dark:text-rose-300">{flagged}</p></div>
            </div>
            <div className="space-y-2">
              {relatedClaims.map((claim) => <button key={claim.id} type="button" onClick={() => onInspectClaim(claim)} className="flex w-full items-start gap-3 rounded-lg border border-neutral-200 p-3 text-left hover:border-[#55C7C2] hover:bg-[#55C7C2]/5 dark:border-[#35337C]">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#55C7C2]" />
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] font-bold text-[#F36B3F]">{claim.id}</span><span className="text-[10px] text-neutral-500">{claim.category}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${claim.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' : claim.verificationStatus === 'conflicted' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{claim.verificationStatus}</span></span><span className="mt-1 block text-xs leading-5 text-neutral-800 dark:text-[#FFF4E3]">{claim.statement}</span><span className="mt-1 block text-[10px] text-neutral-500">Evidence: {claim.sourceLocation}</span></span><span className="text-[10px] font-bold text-[#25245F] dark:text-[#55C7C2]">Inspect →</span>
              </button>)}
              {relatedClaims.length === 0 && <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-xs text-neutral-500">This source has no reconstructed claims yet.</p>}
            </div>
            <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
              <h4 className="text-xs font-bold text-orange-900 dark:text-orange-200">Change impact</h4>
              <p className="mt-1 text-[11px] leading-5 text-orange-800 dark:text-orange-300">If this source is replaced or materially updated, review its {relatedClaims.length} linked claims and {impactedConflicts.length} open conflict(s) before approving a new handover.</p>
              {impactedConflicts.length > 0 && <ul className="mt-2 space-y-1">{impactedConflicts.map((conflict) => <li key={conflict.id} className="text-[11px] font-semibold text-orange-900 dark:text-orange-200">• {conflict.title}</li>)}</ul>}
            </div>
          </> : <p className="py-12 text-center text-xs text-neutral-500">Choose a source node to inspect its evidence connections.</p>}
        </section>
      </div>
    </div>
  );
};
