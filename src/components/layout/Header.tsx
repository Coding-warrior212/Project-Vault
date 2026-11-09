import React from 'react';
import { AppPage, Workspace } from '../../types';
import {
  Menu,
  ShieldCheck,
  Search,
  Plus,
  FileDown,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  currentPage: AppPage;
  currentWorkspace: Workspace;
  onOpenMobileSidebar: () => void;
  onPrimaryAction: () => void;
  onNavigate: (page: AppPage) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  currentWorkspace,
  onOpenMobileSidebar,
  onPrimaryAction,
  onNavigate,
}) => {
  const getPageInfo = () => {
    switch (currentPage) {
      case 'overview':
        return {
          title: 'Project Overview',
          actionLabel: 'Connect Source',
          actionIcon: Plus,
          breadcrumb: 'Overview',
        };
      case 'sources':
        return {
          title: 'Source Ingestion & Evidence Repository',
          actionLabel: 'Add Project Source',
          actionIcon: Plus,
          breadcrumb: 'Sources',
        };
      case 'ledger':
        return {
          title: 'Knowledge Confidence Ledger',
          actionLabel: 'Review Pending',
          actionIcon: ChevronRight,
          breadcrumb: 'Knowledge Ledger',
        };
      case 'review':
        return {
          title: 'Human-in-the-Loop Review Workbench',
          actionLabel: 'Inspect Conflict',
          actionIcon: ShieldCheck,
          breadcrumb: 'Review',
        };
      case 'handover':
        return {
          title: 'Project Handover Dossier',
          actionLabel: 'Generate Handover Package',
          actionIcon: FileDown,
          breadcrumb: 'Handover',
        };
      case 'settings':
        return {
          title: 'Workspace Configuration & Integrations',
          actionLabel: 'Save Changes',
          actionIcon: ShieldCheck,
          breadcrumb: 'Settings',
        };
    }
  };

  const pageInfo = getPageInfo();
  const ActionIcon = pageInfo.actionIcon;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-[#1B1A48]/95 backdrop-blur-xs border-b border-neutral-200 dark:border-[#2D2C68] px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors duration-200">
      {/* Left Zone: Mobile toggle, breadcrumb, page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-neutral-600 dark:text-[#C4C3E0] hover:text-neutral-900 dark:hover:text-[#FFF4E3] rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
          aria-label="Open navigation sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-[#8E8DAF]">
            <span className="font-medium text-neutral-800 dark:text-[#E2E2F0] truncate">
              {currentWorkspace.name}
            </span>
            <ChevronRight className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
            <span className="text-[#25245F] dark:text-[#55C7C2] font-semibold">{pageInfo.breadcrumb}</span>
          </div>

          {/* Current Page Title */}
          <h1 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-[#FFF4E3] truncate">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Center Zone: Explicit Demo Label Badge */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#FFF4E3] dark:bg-[#14133B] border-2 border-[#25245F]/20 dark:border-[#55C7C2]/30 rounded-lg text-xs text-[#25245F] dark:text-[#FFF4E3] shadow-[2px_2px_0px_rgba(37,36,95,0.1)] dark:shadow-[2px_2px_0px_rgba(85,199,194,0.15)] transition-colors">
        <div className="w-2 h-2 rounded-full bg-[#F36B3F] animate-pulse" />
        <span className="font-bold tracking-wide">
          DEMO PROJECT
        </span>
        <span className="text-neutral-400 dark:text-neutral-500">·</span>
        <span className="text-neutral-600 dark:text-[#C4C3E0]">Apex Fleet OS Simulation</span>
      </div>

      {/* Right Zone: Theme Toggle & Primary Action Button */}
      <div className="flex items-center gap-2.5 shrink-0">
        <ThemeToggle />

        <button
          onClick={onPrimaryAction}
          className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#25245F] hover:bg-[#1B1A48] dark:bg-[#F36B3F] dark:hover:bg-[#E0572C] rounded-lg border-2 border-[#25245F] dark:border-[#F36B3F] shadow-[3px_3px_0px_#55C7C2] dark:shadow-[3px_3px_0px_#25245F] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#55C7C2] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <ActionIcon className="w-3.5 h-3.5 text-[#55C7C2] dark:text-white" />
          <span>{pageInfo.actionLabel}</span>
        </button>
      </div>
    </header>
  );
};
