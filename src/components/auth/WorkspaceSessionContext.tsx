import React from 'react';
import type { Session } from '@supabase/supabase-js';

export type ActiveWorkspace = {
  id: string;
  name: string;
  code: string;
  description: string;
  projectType: string;
  role: string;
};
export type WorkspaceSessionValue = {
  session: Session;
  workspace: ActiveWorkspace;
  selectWorkspace: (workspace: ActiveWorkspace) => void;
  switchWorkspace: () => void;
};
const WorkspaceSessionContext = React.createContext<WorkspaceSessionValue | null>(null);
export const WorkspaceSessionProvider = WorkspaceSessionContext.Provider;
export function useWorkspaceSession() {
  return React.useContext(WorkspaceSessionContext);
}
