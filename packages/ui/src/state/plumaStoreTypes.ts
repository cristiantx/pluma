import type { EditorTab } from "../adapters/tabModel.js";
import type { ExplorerNode, StatusMetric } from "../shell/types.js";
import type { ResolvedTheme, ThemePreference } from "../theme.js";

export type PlumaCommandHandlers = {
  openFile: () => void;
  openFolder: () => void;
  toggleMode: () => void;
};

export type ThemeSlice = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  systemPrefersDark: boolean;
};

export type WorkspaceSlice = {
  explorerNodes: ExplorerNode[];
  isBridgeAvailable: boolean;
  workspaceLabel: string;
  workspacePath: string;
};

export type TabsSlice = {
  activeTabId: string;
  tabs: EditorTab[];
};

export type StatusSlice = {
  statusMetrics: StatusMetric[];
};

export type CommandsSlice = {
  commandHandlers: PlumaCommandHandlers;
};

export type PlumaShellSnapshot = {
  explorerNodes: ExplorerNode[];
  isBridgeAvailable: boolean;
  statusMetrics: StatusMetric[];
  tabs: EditorTab[];
  workspaceLabel: string;
  workspacePath: string;
};

export type PlumaStoreState = {
  commands: CommandsSlice;
  status: StatusSlice;
  tabs: TabsSlice;
  theme: ThemeSlice;
  workspace: WorkspaceSlice;
};

export type PlumaStoreActions = {
  closeTab: (tabId: string) => void;
  hydrateShellSnapshot: (snapshot: PlumaShellSnapshot) => void;
  reorderTabs: (tabs: EditorTab[]) => void;
  setActiveTabId: (tabId: string) => void;
  setCommandHandlers: (handlers: Partial<PlumaCommandHandlers>) => void;
  setSystemPrefersDark: (matches: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  triggerOpenFile: () => void;
  triggerOpenFolder: () => void;
  triggerToggleMode: () => void;
};

export type PlumaStore = PlumaStoreState & PlumaStoreActions;

export type PlumaStoreInitializer = {
  commands: CommandsSlice;
  status: StatusSlice;
  tabs: TabsSlice;
  theme: ThemeSlice;
  workspace: WorkspaceSlice;
};
