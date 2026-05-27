import { PaneLayout } from "../panes/PaneLayout.js";
import { EditorWorkspace } from "./EditorWorkspace.js";
import { Sidebar } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { TitleBar } from "./TitleBar.js";
import type { PlumaShellProps } from "./types.js";

export function PlumaShell({
  activeTabId,
  explorerNodes,
  isBridgeAvailable,
  onActiveTabChange,
  onOpenFile,
  onOpenFolder,
  onTabClose,
  onThemePreferenceChange,
  onToggleMode,
  onToggleTheme,
  onTabsReorder,
  resolvedTheme,
  statusMetrics,
  tabs,
  themePreference,
  workspaceLabel,
  workspacePath
}: PlumaShellProps) {
  return (
    <main className="shell" data-theme={resolvedTheme}>
      <TitleBar
        isBridgeAvailable={isBridgeAvailable}
        onOpenFolder={onOpenFolder}
        onToggleMode={onToggleMode}
        onToggleTheme={onToggleTheme}
        resolvedTheme={resolvedTheme}
        workspacePath={workspacePath}
      />

      <PaneLayout
        main={
          <EditorWorkspace
            activeTabId={activeTabId}
            onActiveTabChange={onActiveTabChange}
            onOpenFile={onOpenFile}
            onTabClose={onTabClose}
            onTabsReorder={onTabsReorder}
            tabs={tabs}
          />
        }
        primary={
          <Sidebar
            nodes={explorerNodes}
            onOpenFile={onOpenFile}
            onOpenFolder={onOpenFolder}
            workspaceLabel={workspaceLabel}
          />
        }
      />

      <StatusBar
        metrics={statusMetrics}
        onThemePreferenceChange={onThemePreferenceChange}
        themePreference={themePreference}
      />
    </main>
  );
}
