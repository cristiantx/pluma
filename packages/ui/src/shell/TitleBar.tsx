import {
  BookOpen,
  Bug,
  ChevronDown,
  Code2,
  Columns2,
  Folder,
  PanelLeft,
  Moon,
  Sun
} from "lucide-react";
import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { PlumaLogo } from "./PlumaLogo.js";
import { TitleBarButton } from "./TitleBarButton.js";

export const TitleBar = memo(function TitleBar() {
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const isBridgeAvailable = usePlumaStore(
    (state) => state.workspace.isBridgeAvailable
  );
  const isDevelopment = usePlumaStore((state) => state.workspace.isDevelopment);
  const workspacePath = usePlumaStore((state) => state.workspace.workspacePath);
  const isSidebarVisible = usePlumaStore(
    (state) => state.layout.isSidebarVisible
  );
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const triggerOpenDevTools = usePlumaStore(
    (state) => state.triggerOpenDevTools
  );
  const triggerOpenFolder = usePlumaStore((state) => state.triggerOpenFolder);
  const editorViewMode = usePlumaStore((state) => state.layout.editorViewMode);
  const setEditorViewMode = usePlumaStore((state) => state.setEditorViewMode);
  const toggleTheme = usePlumaStore((state) => state.toggleTheme);
  const toggleSidebar = usePlumaStore((state) => state.toggleSidebar);
  const ThemeToggleIcon = resolvedTheme === "dark" ? Sun : Moon;

  return (
    <header className={`titlebar ${hasWorkspace ? "with-workspace" : ""}`}>
      {hasWorkspace ? (
        <TitleBarButton
          aria-label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
          className="titlebar-sidebar-toggle"
          icon={PanelLeft}
          isPressed={isSidebarVisible}
          onClick={toggleSidebar}
        />
      ) : null}

      {hasWorkspace ? (
        <button
          aria-label="Open folder"
          className="titlebar-path"
          onClick={triggerOpenFolder}
          type="button"
        >
          <Folder aria-hidden="true" />
          <span>{workspacePath}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      ) : (
        <div className="titlebar-brand">
          <PlumaLogo />
          <span>Pluma</span>
        </div>
      )}

      <div className="titlebar-actions">
        {!isBridgeAvailable ? (
          <span className="bridge-warning">Offline</span>
        ) : null}
        <TitleBarButton
          aria-label="Toggle theme"
          icon={ThemeToggleIcon}
          onClick={toggleTheme}
        />
        {isDevelopment ? (
          <TitleBarButton
            aria-label="Open DevTools"
            icon={Bug}
            onClick={triggerOpenDevTools}
          />
        ) : null}
        <TitleBarButton
          aria-label="Source view"
          icon={Code2}
          isActive={editorViewMode === "source"}
          onClick={() => setEditorViewMode("source")}
        />
        <TitleBarButton
          aria-label="Split view"
          icon={Columns2}
          isActive={editorViewMode === "split"}
          onClick={() => setEditorViewMode("split")}
        />
        <TitleBarButton
          aria-label="Rich view"
          icon={BookOpen}
          isActive={editorViewMode === "rich"}
          onClick={() => setEditorViewMode("rich")}
        />
      </div>
    </header>
  );
});
