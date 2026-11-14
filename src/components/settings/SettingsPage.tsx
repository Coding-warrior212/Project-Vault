import React from 'react';
import { Workspace } from '../../types';
import {
  Settings,
  Cpu,
  Database,
  Github,
  Sliders,
  ShieldCheck,
  RefreshCw,
  Info,
  Check,
  Layers,
  Sparkles,
} from 'lucide-react';

interface SettingsPageProps {
  currentWorkspace: Workspace;
  onResetSampleData: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentWorkspace,
  onResetSampleData,
}) => {
  const [threshold, setThreshold] = React.useState(75);
  const [conflictSensitivity, setConflictSensitivity] = React.useState<'strict' | 'standard'>('strict');
  const [autoDeduplicate, setAutoDeduplicate] = React.useState(true);
  const [isSaved, setIsSaved] = React.useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-6 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#25245F] dark:text-[#55C7C2]">
                Settings & Integration Architecture
              </span>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-[#FFF4E3] mt-1">
              Workspace Configuration & Engine Parameters
            </h2>
            <p className="text-xs text-neutral-600 dark:text-[#C4C3E0] mt-0.5">
              Configure extraction confidence rules, workspace metadata, and future integration endpoints.
            </p>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white dark:text-[#111033] bg-[#25245F] dark:bg-[#55C7C2] hover:bg-[#1B1A48] dark:hover:bg-[#46aba6] rounded-lg border-2 border-[#25245F] dark:border-[#55C7C2] shadow-[3px_3px_0px_#55C7C2] dark:shadow-[3px_3px_0px_#25245F] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            {isSaved ? <Check className="w-3.5 h-3.5 text-[#55C7C2] dark:text-[#111033]" /> : null}
            <span>{isSaved ? 'Saved Settings' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Workspace Profile Card */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <Layers className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
          Active Workspace Metadata
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-neutral-500 dark:text-[#8E8DAF] font-semibold mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              defaultValue={currentWorkspace.name}
              className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] font-medium focus:outline-none focus:ring-1 focus:ring-[#25245F] dark:focus:ring-[#55C7C2]"
            />
          </div>

          <div>
            <label className="block text-neutral-500 dark:text-[#8E8DAF] font-semibold mb-1">
              Project Identifier Code
            </label>
            <input
              type="text"
              defaultValue={currentWorkspace.code}
              className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#25245F] dark:focus:ring-[#55C7C2]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-neutral-500 dark:text-[#8E8DAF] font-semibold mb-1">
              Workspace Description & Scope
            </label>
            <textarea
              defaultValue={currentWorkspace.description}
              rows={2}
              className="w-full p-2 bg-neutral-50 dark:bg-[#14133B] border border-neutral-300 dark:border-[#35337C] rounded-lg text-neutral-900 dark:text-[#FFF4E3] focus:outline-none focus:ring-1 focus:ring-[#25245F] dark:focus:ring-[#55C7C2]"
            />
          </div>
        </div>
      </div>

      {/* Extraction & Confidence Engine Settings */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <Cpu className="w-3.5 h-3.5 text-[#F36B3F]" />
          Knowledge Confidence & Conflict Engine Rules
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">
                Minimum Verification Confidence Threshold
              </span>
              <span className="font-mono font-bold text-[#25245F] dark:text-[#55C7C2]">{threshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[#25245F] dark:accent-[#55C7C2]"
            />
            <p className="text-[11px] text-neutral-500 dark:text-[#8E8DAF] mt-1">
              Claims with confidence scores below this threshold will automatically be queued for human verification in the Review tab.
            </p>
          </div>

          <div className="pt-3 border-t-2 border-neutral-100 dark:border-[#2D2C68] flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3]">
                Conflict Detection Strictness
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-[#8E8DAF]">
                Flag subtle numerical and version differences as explicit discrepancies.
              </div>
            </div>
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#14133B] p-1 rounded-lg border border-neutral-300 dark:border-[#2D2C68]">
              <button
                onClick={() => setConflictSensitivity('strict')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  conflictSensitivity === 'strict'
                    ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] font-bold shadow-xs'
                    : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Strict (Recommended)
              </button>
              <button
                onClick={() => setConflictSensitivity('standard')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  conflictSensitivity === 'standard'
                    ? 'bg-white dark:bg-[#25245F] text-[#25245F] dark:text-[#FFF4E3] font-bold shadow-xs'
                    : 'text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Standard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Next Stage Integration Roadmap */}
      <div className="bg-white dark:bg-[#1B1A48] rounded-xl p-5 border-2 border-neutral-300 dark:border-[#2D2C68] neo-box-sm space-y-4 transition-colors">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#FFF4E3] flex items-center gap-1.5 pb-2 border-b-2 border-neutral-100 dark:border-[#2D2C68]">
          <Database className="w-3.5 h-3.5 text-[#55C7C2]" />
          Backend & AI Integration Readiness
        </h3>

        <div className="space-y-3">
          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F36B3F]" />
                Gemini API Knowledge Synthesizer
              </div>
              <div className="text-neutral-500 dark:text-[#8E8DAF] text-[11px]">
                AI extraction and conflict analysis are temporarily disabled until verified sign-in and workspace authorization are enforced server-side.
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
              Paused — authorization pending
            </span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#55C7C2]" />
                PostgreSQL & Supabase Persistence
              </div>
              <div className="text-neutral-500 dark:text-[#8E8DAF] text-[11px]">
                Supabase SDK is installed. Auth, workspace-scoped cloud persistence, Storage, and Realtime are not connected yet.
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
              SDK installed · integration pending
            </span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-[#14133B] rounded-lg border-2 border-neutral-200 dark:border-[#2D2C68] flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-neutral-900 dark:text-[#FFF4E3] flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-[#25245F] dark:text-[#55C7C2]" />
                GitHub REST API & Webhooks
              </div>
              <div className="text-neutral-500 dark:text-[#8E8DAF] text-[11px]">
                GitHub repository synchronization and change-impact analysis are planned; no repository connection is active.
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/40 px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700">
              Not connected
            </span>
          </div>
        </div>
      </div>

      {/* Reset Demo Data Action */}
      <div className="p-4 bg-[#FFF4E3]/60 dark:bg-[#25245F]/30 rounded-xl border-2 border-[#E5B25D]/50 dark:border-[#55C7C2]/40 neo-box-sm flex items-center justify-between text-xs transition-colors">
        <div>
          <span className="font-bold text-[#25245F] dark:text-[#55C7C2] block">
            Reset Demo Workspace Data
          </span>
          <span className="text-neutral-600 dark:text-[#C4C3E0] text-[11px]">
            Restores the initial sample sources, claims, and activity logs for evaluation.
          </span>
        </div>
        <button
          onClick={onResetSampleData}
          className="px-3.5 py-1.5 text-xs font-bold text-[#25245F] dark:text-[#FFF4E3] bg-white dark:bg-[#1B1A48] hover:bg-neutral-50 dark:hover:bg-[#25245F] border-2 border-[#25245F]/40 dark:border-[#35337C] rounded-lg shadow-[2px_2px_0px_rgba(37,36,95,0.15)] dark:shadow-[2px_2px_0px_rgba(85,199,194,0.15)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Sample Data</span>
        </button>
      </div>
    </div>
  );
};
