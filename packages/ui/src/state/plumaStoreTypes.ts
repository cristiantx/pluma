import type { DocumentSession } from "@pluma/core";

import type { PlumaTab } from "../adapters/tabModel.js";
import type { AppSettings } from "../settings.js";
import type { ExplorerNode, StatusMetric } from "../shell/types.js";
import type { ResolvedTheme, ThemePreference } from "../theme.js";

export type PlumaCommandHandlers = {
  closeTab: (tabId: string) => void;
  compareConflict: () => void;
  keepEditing: () => void;
  newFile: () => void;
  openDevTools: () => void;
  openAppDataFolder: () => void;
  openFile: () => void;
  openFolder: () => void;
  openExternalUrl: (url: string) => void;
  openSettingsFile: () => void;
  openWorkspaceFile: (path: string) => void;
  searchWorkspace: (
    query: string,
    folderPath: string | null,
    options: WorkspaceSearchOptions
  ) => Promise<WorkspaceSearchMatch[]>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  reloadFromDisk: () => void;
  resetSettings: () => Promise<AppSettings>;
  setActiveTabId: (tabId: string) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  showTabContextMenu: (tabId: string, tabIds: string[]) => void;
  showWorkspaceContextMenu: (path: string, kind: ExplorerNode["kind"]) => void;
  updateDocumentText: (documentId: string, rawText: string) => void;
  updatePaneSizes: (paneSizes: number[]) => void;
  toggleMode: () => void;
};

export type EditorViewMode = "source" | "rich" | "preview";
export type SidebarView = "workspace" | "search";

export type ThemeSlice = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  systemPrefersDark: boolean;
};

type WritingSlice = {
  spellcheckEnabled: boolean;
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
  tabs: PlumaTab[];
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
  documentViewModes: Record<string, EditorViewMode>;
  editorViewMode: EditorViewMode;
  paneSizes: number[];
  isSidebarVisible: boolean;
};

type SettingsSlice = AppSettings;

export type PlumaShellSnapshot = {
  activeDocument: DocumentSession | null;
  activeDocumentId: string | null;
  activeTabId: string | null;
  documents: DocumentSession[];
  documentViewModes: Record<string, EditorViewMode>;
  explorerNodes: ExplorerNode[];
  hasWorkspace: boolean;
  isBridgeAvailable: boolean;
  isDevelopment: boolean;
  editorViewMode: EditorViewMode;
  paneSizes: number[];
  statusMetrics: StatusMetric[];
  tabs: PlumaTab[];
  workspaceLabel: string;
  workspacePath: string;
};

export type PlumaStoreState = {
  commands: CommandsSlice;
  document: DocumentSlice;
  layout: LayoutSlice;
  settings: SettingsSlice;
  status: StatusSlice;
  tabs: TabsSlice;
  theme: ThemeSlice;
  writing: WritingSlice;
  workspace: WorkspaceSlice;
};

export type PlumaStoreActions = {
  closeTab: (tabId: string) => void;
  compareConflict: () => void;
  closeSettingsTab: () => void;
  hydrateShellSnapshot: (snapshot: PlumaShellSnapshot) => void;
  hydrateSettings: (settings: AppSettings) => void;
  reorderTabs: (tabs: PlumaTab[]) => void;
  keepEditing: () => void;
  openSettingsTab: () => void;
  openAppDataFolder: () => void;
  openExternalUrl: (url: string) => void;
  openSettingsFile: () => void;
  openWorkspaceSearch: (folderPath: string | null) => void;
  revealWorkspaceSearchMatch: (match: WorkspaceSearchMatch) => void;
  setWorkspaceSearchHasSearched: (hasSearched: boolean) => void;
  setWorkspaceSearchOptions: (options: WorkspaceSearchOptions) => void;
  setWorkspaceSearchQuery: (query: string) => void;
  setWorkspaceSearchResults: (results: WorkspaceSearchMatch[]) => void;
  toggleWorkspaceSearchResultFile: (filePath: string) => void;
  reloadFromDisk: () => void;
  resetSettings: () => Promise<void>;
  revealWorkspaceFile: (path: string) => void;
  setActiveTabId: (tabId: string) => void;
  setCommandHandlers: (handlers: Partial<PlumaCommandHandlers>) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  setSidebarView: (view: SidebarView) => void;
  showTabContextMenu: (tabId: string) => void;
  showWorkspaceContextMenu: (path: string, kind: ExplorerNode["kind"]) => void;
  setSystemPrefersDark: (matches: boolean) => void;
  setSpellcheckEnabled: (enabled: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
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
  settings: SettingsSlice;
  status: StatusSlice;
  tabs: TabsSlice;
  theme: ThemeSlice;
  writing: WritingSlice;
  workspace: WorkspaceSlice;
};
