import React from 'react';
import { AppPage, Workspace } from '../../types';
import {
  LayoutDashboard,
  FolderGit2,
  FileSpreadsheet,
  CheckSquare,
  FileCheck2,
  Settings,
  ChevronDown,
  Layers,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

import { Vault3DLogo } from '../common/Soft3DVisuals';

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  onSelectWorkspace: (workspace: Workspace) => void;
  unverifiedCount: number;
  conflictedCount: number;
  sourcesCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  unverifiedCount,
  conflictedCount,
  sourcesCount,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [showWorkspaceMenu, setShowWorkspaceMenu] = React.useState(false);

  const navItems = [
    {
      id: 'overview' as AppPage,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'sources' as AppPage,
      label: 'Sources',
      icon: FolderGit2,
      badge: sourcesCount.toString(),
    },
    {
      id: 'ledger' as AppPage,
      label: 'Knowledge Ledger',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: 'review' as AppPage,
      label: 'Review',
      icon: CheckSquare,
      badge: conflictedCount > 0 ? `${conflictedCount} alert` : unverifiedCount > 0 ? `${unverifiedCount}` : null,
      badgeColor: conflictedCount > 0 ? 'bg-[#F36B3F] text-white' : 'bg-[#25245F]/20 text-white',
    },
    {
      id: 'handover' as AppPage,
      label: 'Handover',
      icon: FileCheck2,
      badge: 'Draft',
      badgeColor: 'bg-[#55C7C2]/20 text-[#55C7C2]',
    },
    {
      id: 'settings' as AppPage,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#25245F] dark:bg-[#15143C] text-white flex flex-col border-r-2 border-[#1B1A48] dark:border-[#232258] shadow-[4px_0px_0px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand & Logo Area */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Soft 3D Dimensional Vault Insignia */}
              <Vault3DLogo size="md" />

              <div>
                <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
                  ProjectVault
                </span>
                <p className="text-[11px] text-white/70 leading-tight">
                  Knowledge that stays.
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-white/60 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Selector with Tactile 3D Inset */}
        <div className="p-3 border-b border-white/10 relative">
          <button
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-all text-xs border border-white/10 hover:border-white/20 active:translate-y-[1px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-md bg-[#FFF4E3] text-[#25245F] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs border border-[#E5B25D]/50">
                {currentWorkspace.code.slice(0, 3)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {currentWorkspace.name}
                </div>
                <div className="text-[10px] text-white/50 truncate font-mono">
                  {currentWorkspace.code} · Active Handover
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-white/60 shrink-0 ml-1" />
          </button>

          {/* Workspace Switcher Dropdown */}
          {showWorkspaceMenu && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-[#1B1A48] dark:bg-[#15143C] border border-white/15 dark:border-[#2D2C68] rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in duration-150">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-white/40 tracking-wider">
                Select Workspace
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    onSelectWorkspace(ws);
                    setShowWorkspaceMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/10 transition-colors ${
                    ws.id === currentWorkspace.id ? 'bg-white/10 text-[#55C7C2] font-medium' : 'text-white/80'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === currentWorkspace.id && (
                    <span className="text-[10px] text-[#55C7C2] font-mono">active</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-bold text-white/40">
            Platform Workflow
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors group ${
                  isActive
                    ? 'bg-[#F36B3F] text-white font-semibold shadow-xs'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Workflow Sequence Dynamic Indicator */}
          {(() => {
            const getStage = (page: AppPage) => {
              switch (page) {
                case 'sources':
                  return { step: 1, name: 'CONNECT', label: 'Stage 1 / 5' };
                case 'ledger':
                  return { step: 3, name: 'VERIFY', label: 'Stage 3 / 5' };
                case 'review':
                  return { step: 4, name: 'REVIEW', label: 'Stage 4 / 5' };
                case 'handover':
                  return { step: 5, name: 'HANDOVER', label: 'Stage 5 / 5' };
                case 'overview':
                case 'settings':
                default:
                  return { step: 4, name: 'REVIEW', label: 'Stage 4 / 5' };
              }
            };
            const currentStage = getStage(currentPage);

            return (
              <div className="pt-4 mt-4 border-t border-white/10 px-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">
                    Workflow Pipeline
                  </span>
                  <span className="text-[10px] font-mono text-[#55C7C2]">
                    {currentStage.label}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 mb-2">
                  <div
                    className={`h-1 rounded-full ${
                      currentStage.step > 1 ? 'bg-[#55C7C2]' : currentStage.step === 1 ? 'bg-[#F36B3F] animate-pulse' : 'bg-white/20'
                    }`}
                    title="Connect (Stage 1)"
                  />
                  <div
                    className={`h-1 rounded-full ${
                      currentStage.step > 2 ? 'bg-[#55C7C2]' : currentStage.step === 2 ? 'bg-[#F36B3F] animate-pulse' : 'bg-white/20'
                    }`}
                    title="Reconstruct (Stage 2)"
                  />
                  <div
                    className={`h-1 rounded-full ${
                      currentStage.step > 3 ? 'bg-[#55C7C2]' : currentStage.step === 3 ? 'bg-[#F36B3F] animate-pulse' : 'bg-white/20'
                    }`}
                    title="Verify (Stage 3)"
                  />
                  <div
                    className={`h-1 rounded-full ${
                      currentStage.step > 4 ? 'bg-[#55C7C2]' : currentStage.step === 4 ? 'bg-[#F36B3F] animate-pulse' : 'bg-white/20'
                    }`}
                    title="Review (Stage 4)"
                  />
                  <div
                    className={`h-1 rounded-full ${
                      currentStage.step === 5 ? 'bg-[#F36B3F] animate-pulse' : 'bg-white/20'
                    }`}
                    title="Handover (Stage 5)"
                  />
                </div>
                <p className="text-[11px] text-white/60 leading-tight">
                  <span className={currentStage.step === 1 ? 'text-[#F36B3F] font-bold' : currentStage.step > 1 ? 'text-[#55C7C2]' : ''}>CONNECT</span>
                  {' → '}
                  <span className={currentStage.step === 2 ? 'text-[#F36B3F] font-bold' : currentStage.step > 2 ? 'text-[#55C7C2]' : ''}>RECONSTRUCT</span>
                  {' → '}
                  <span className={currentStage.step === 3 ? 'text-[#F36B3F] font-bold' : currentStage.step > 3 ? 'text-[#55C7C2]' : ''}>VERIFY</span>
                  {' → '}
                  <span className={currentStage.step === 4 ? 'text-[#F36B3F] font-bold' : currentStage.step > 4 ? 'text-[#55C7C2]' : ''}>REVIEW</span>
                  {' → '}
                  <span className={currentStage.step === 5 ? 'text-[#F36B3F] font-bold' : ''}>HANDOVER</span>
                </p>
              </div>
            );
          })()}
        </nav>

        {/* User Profile / Status Footer */}
        <div className="p-3 border-t border-white/10 bg-[#1B1A48]/60">
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#55C7C2] to-[#FFF4E3] text-[#25245F] font-bold text-xs flex items-center justify-center shrink-0">
                ER
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">
                  Elena Rostova
                </div>
                <div className="text-[10px] text-white/50 truncate">
                  Principal Architect
                </div>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#55C7C2]" title="Session Active" />
          </div>
        </div>
      </aside>
    </>
  );
};
