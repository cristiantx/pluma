import { EditorWorkspace } from "./EditorWorkspace.js";
import { Sidebar } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { TitleBar } from "./TitleBar.js";
import type { PlumaShellProps } from "./types.js";

export function PlumaShell({
  activeFileLabel,
  explorerNodes,
  isBridgeAvailable,
  onOpenFile,
  onOpenFolder,
  onThemePreferenceChange,
  onToggleMode,
  onToggleTheme,
  resolvedTheme,
  statusMetrics,
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

      <div className="workspace-shell">
        <Sidebar
          nodes={explorerNodes}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          workspaceLabel={workspaceLabel}
        />

        <EditorWorkspace
          activeFileLabel={activeFileLabel}
          onOpenFile={onOpenFile}
        />
      </div>

      <StatusBar
        metrics={statusMetrics}
        onThemePreferenceChange={onThemePreferenceChange}
        themePreference={themePreference}
      />
    </main>
  );
}
