import {
  ChevronDown,
  Columns2,
  Folder,
  Moon,
  PanelRight,
  Square,
  Sun
} from "lucide-react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { PlumaLogo } from "./PlumaLogo.js";

export function TitleBar() {
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const isBridgeAvailable = usePlumaStore(
    (state) => state.workspace.isBridgeAvailable
  );
  const workspacePath = usePlumaStore((state) => state.workspace.workspacePath);
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const triggerOpenFolder = usePlumaStore((state) => state.triggerOpenFolder);
  const triggerToggleMode = usePlumaStore((state) => state.triggerToggleMode);
  const toggleTheme = usePlumaStore((state) => state.toggleTheme);
  const ThemeToggleIcon = resolvedTheme === "dark" ? Sun : Moon;

  return (
    <header className="titlebar">
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
        <button
          aria-label="Toggle theme"
          className="tool-button"
          onClick={toggleTheme}
          type="button"
        >
          <ThemeToggleIcon aria-hidden="true" />
        </button>
        <button
          aria-label="Toggle editor mode"
          className="tool-button is-active"
          onClick={triggerToggleMode}
          type="button"
        >
          <Columns2 aria-hidden="true" />
        </button>
        <button aria-label="Preview" className="tool-button" type="button">
          <Square aria-hidden="true" />
        </button>
        <button aria-label="Outline" className="tool-button" type="button">
          <PanelRight aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
