import type { ResolvedTheme, ThemePreference } from "../theme.js";

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
  activeFileLabel: string;
  explorerNodes: ExplorerNode[];
  isBridgeAvailable: boolean;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onToggleMode: () => void;
  onToggleTheme: () => void;
  resolvedTheme: ResolvedTheme;
  statusMetrics: StatusMetric[];
  themePreference: ThemePreference;
  workspaceLabel: string;
  workspacePath: string;
};
