import type { ResolvedTheme } from "../theme.js";
import type { EditorTab } from "./tabModel.js";

export type ExplorerNode = {
  depth: number;
  isActive?: boolean;
  isExpanded?: boolean;
  kind: "folder" | "file";
  label: string;
};

export type StatusMetric = {
  label: string;
  value: string;
};

export type PlumaShellProps = {
  activeTabId: string;
  explorerNodes: ExplorerNode[];
  isBridgeAvailable: boolean;
  onActiveTabChange: (tabId: string) => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onTabClose: (tabId: string) => void;
  onToggleMode: () => void;
  onToggleTheme: () => void;
  onTabsReorder: (tabs: EditorTab[]) => void;
  resolvedTheme: ResolvedTheme;
  statusMetrics: StatusMetric[];
  tabs: EditorTab[];
  workspaceLabel: string;
  workspacePath: string;
};
