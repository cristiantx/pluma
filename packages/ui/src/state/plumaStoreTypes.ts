import type { DocumentSession } from "@pluma/core";

import type { EditorTab } from "../adapters/tabModel.js";
import type { ExplorerNode, StatusMetric } from "../shell/types.js";
import type { ResolvedTheme, ThemePreference } from "../theme.js";

export type PlumaCommandHandlers = {
  closeTab: (tabId: string) => void;
  compareConflict: () => void;
  keepEditing: () => void;
  newFile: () => void;
  openDevTools: () => void;
  openFile: () => void;
  openFolder: () => void;
  openWorkspaceFile: (path: string) => void;
  reloadFromDisk: () => void;
  setActiveTabId: (tabId: string) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  updateDocumentText: (documentId: string, rawText: string) => void;
  updatePaneSizes: (paneSizes: number[]) => void;
  toggleMode: () => void;
};

export type EditorViewMode = "source" | "rich" | "split";

export type ThemeSlice = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  systemPrefersDark: boolean;
};

export type WorkspaceSlice = {
  explorerNodes: ExplorerNode[];
  hasWorkspace: boolean;
  isBridgeAvailable: boolean;
  isDevelopment: boolean;
  workspaceLabel: string;
  workspacePath: string;
};

export type TabsSlice = {
  activeTabId: string;
  tabs: EditorTab[];
};

export type DocumentSlice = {
  activeDocument: DocumentSession | null;
  documents: DocumentSession[];
};

export type StatusSlice = {
  statusMetrics: StatusMetric[];
};

export type CommandsSlice = {
  commandHandlers: PlumaCommandHandlers;
};

export type LayoutSlice = {
  editorViewMode: EditorViewMode;
  paneSizes: number[];
  isSidebarVisible: boolean;
};

export type PlumaShellSnapshot = {
  activeDocument: DocumentSession | null;
  activeDocumentId: string | null;
  documents: DocumentSession[];
  explorerNodes: ExplorerNode[];
  hasWorkspace: boolean;
  isBridgeAvailable: boolean;
  isDevelopment: boolean;
  editorViewMode: EditorViewMode;
  paneSizes: number[];
  statusMetrics: StatusMetric[];
  tabs: EditorTab[];
  workspaceLabel: string;
  workspacePath: string;
};

export type PlumaStoreState = {
  commands: CommandsSlice;
  document: DocumentSlice;
  layout: LayoutSlice;
  status: StatusSlice;
  tabs: TabsSlice;
  theme: ThemeSlice;
  workspace: WorkspaceSlice;
};

export type PlumaStoreActions = {
  closeTab: (tabId: string) => void;
  compareConflict: () => void;
  hydrateShellSnapshot: (snapshot: PlumaShellSnapshot) => void;
  reorderTabs: (tabs: EditorTab[]) => void;
  keepEditing: () => void;
  reloadFromDisk: () => void;
  setActiveTabId: (tabId: string) => void;
  setCommandHandlers: (handlers: Partial<PlumaCommandHandlers>) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  setSystemPrefersDark: (matches: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  triggerOpenDevTools: () => void;
  triggerNewFile: () => void;
  triggerOpenFile: () => void;
  triggerOpenFolder: () => void;
  triggerOpenWorkspaceFile: (path: string) => void;
  updateDocumentText: (documentId: string, rawText: string) => void;
  updatePaneSizes: (paneSizes: number[]) => void;
  triggerToggleMode: () => void;
};

export type PlumaStore = PlumaStoreState & PlumaStoreActions;

export type PlumaStoreInitializer = {
  commands: CommandsSlice;
  document: DocumentSlice;
  layout: LayoutSlice;
  status: StatusSlice;
  tabs: TabsSlice;
  theme: ThemeSlice;
  workspace: WorkspaceSlice;
};
