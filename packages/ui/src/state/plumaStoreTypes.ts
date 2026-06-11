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
  searchWorkspace: (
    query: string,
    folderPath: string | null,
    options: WorkspaceSearchOptions
  ) => Promise<WorkspaceSearchMatch[]>;
  reloadFromDisk: () => void;
  setActiveTabId: (tabId: string) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  showTabContextMenu: (tabId: string) => void;
  showWorkspaceContextMenu: (path: string, kind: ExplorerNode["kind"]) => void;
  updateDocumentText: (documentId: string, rawText: string) => void;
  updatePaneSizes: (paneSizes: number[]) => void;
  toggleMode: () => void;
};

export type EditorViewMode = "source" | "rich" | "split";
export type SidebarView = "workspace" | "search";

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
  revealRequestId: number;
  revealWorkspacePath: string | null;
  collapsedSearchResultFiles: string[];
  searchFolderPath: string | null;
  searchHasSearched: boolean;
  searchOptions: WorkspaceSearchOptions;
  searchQuery: string;
  searchRevealRequest: WorkspaceSearchRevealRequest | null;
  searchResults: WorkspaceSearchMatch[];
  searchRequestId: number;
  sidebarView: SidebarView;
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
  splitPaneSizesByDocumentId: Record<string, number[]>;
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
  openWorkspaceSearch: (folderPath: string | null) => void;
  revealWorkspaceSearchMatch: (match: WorkspaceSearchMatch) => void;
  setWorkspaceSearchHasSearched: (hasSearched: boolean) => void;
  setWorkspaceSearchOptions: (options: WorkspaceSearchOptions) => void;
  setWorkspaceSearchQuery: (query: string) => void;
  setWorkspaceSearchResults: (results: WorkspaceSearchMatch[]) => void;
  toggleWorkspaceSearchResultFile: (filePath: string) => void;
  reloadFromDisk: () => void;
  revealWorkspaceFile: (path: string) => void;
  setActiveTabId: (tabId: string) => void;
  setCommandHandlers: (handlers: Partial<PlumaCommandHandlers>) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  setSidebarView: (view: SidebarView) => void;
  showTabContextMenu: (tabId: string) => void;
  showWorkspaceContextMenu: (path: string, kind: ExplorerNode["kind"]) => void;
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
  updateSplitPaneSizes: (documentId: string, paneSizes: number[]) => void;
  triggerToggleMode: () => void;
};

export type WorkspaceSearchMatch = {
  filePath: string;
  line: number;
  lineText: string;
  matchEnd: number;
  matchStart: number;
  preview: string;
};

export type WorkspaceSearchOptions = {
  caseSensitive: boolean;
  regexp: boolean;
  wholeWord: boolean;
};

export type WorkspaceSearchRevealRequest = {
  match: WorkspaceSearchMatch;
  requestId: number;
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
