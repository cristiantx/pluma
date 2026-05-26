import {
  ChevronDown,
  Columns2,
  Folder,
  Moon,
  PanelRight,
  Square,
  Sun
} from "lucide-react";

import type { ResolvedTheme } from "../theme.js";

type TitleBarProps = {
  isBridgeAvailable: boolean;
  onOpenFolder: () => void;
  onToggleMode: () => void;
  onToggleTheme: () => void;
  resolvedTheme: ResolvedTheme;
  workspacePath: string;
};

export function TitleBar({
  isBridgeAvailable,
  onOpenFolder,
  onToggleMode,
  onToggleTheme,
  resolvedTheme,
  workspacePath
}: TitleBarProps) {
  const ThemeToggleIcon = resolvedTheme === "dark" ? Sun : Moon;

  return (
    <header className="titlebar">
      <button
        aria-label="Open folder"
        className="titlebar-path"
        onClick={onOpenFolder}
        type="button"
      >
        <Folder aria-hidden="true" />
        <span>{workspacePath}</span>
        <ChevronDown aria-hidden="true" />
      </button>

      <div className="titlebar-actions">
        {!isBridgeAvailable ? (
          <span className="bridge-warning">Offline</span>
        ) : null}
        <button
          aria-label="Toggle theme"
          className="tool-button"
          onClick={onToggleTheme}
          type="button"
        >
          <ThemeToggleIcon aria-hidden="true" />
        </button>
        <button
          aria-label="Toggle editor mode"
          className="tool-button is-active"
          onClick={onToggleMode}
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
