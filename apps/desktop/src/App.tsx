import { useEffect, useState } from "react";

import {
  PlumaShell,
  readStoredThemePreference,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference
} from "@pluma/ui";
import {
  initialShellState,
  reduceShellEvent,
  type CommandName
} from "./shellState";
import {
  extractLeafName,
  getExplorerNodes,
  getStatusMetrics,
  getWorkspaceLabel
} from "./shellView";
function getInitialThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  return readStoredThemePreference(
    window.localStorage.getItem(THEME_STORAGE_KEY)
  );
}

function getInitialSystemPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function App() {
  const [shellState, setShellState] = useState(initialShellState);
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    getInitialThemePreference
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    getInitialSystemPreference
  );
  const [isBridgeAvailable, setIsBridgeAvailable] = useState(false);

  useEffect(() => {
    if (!window.pluma) {
      setShellState((current) => ({
        ...current,
        status: "Renderer loaded without preload bridge."
      }));
      return;
    }

    setIsBridgeAvailable(true);

    return window.pluma.onEvent((event) => {
      setShellState((current) => reduceShellEvent(current, event));
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const resolvedTheme = resolveThemePreference(
    themePreference,
    systemPrefersDark
  );

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

  const runCommand = (command: CommandName) => {
    if (!window.pluma) {
      setShellState((current) => ({
        ...current,
        status: `Cannot run "${command}" because IPC is unavailable.`
      }));
      return;
    }

    void window.pluma.runCommand(command);
  };

  const workspaceLabel = getWorkspaceLabel(shellState);
  const explorerNodes = getExplorerNodes(shellState);
  const statusMetrics = getStatusMetrics(shellState);
  const activeFileLabel =
    extractLeafName(shellState.activeFile) ?? "Welcome.md";
  const workspacePath = shellState.activeFolder ?? "~/Documents/Pluma Docs";

  return (
    <PlumaShell
      activeFileLabel={activeFileLabel}
      explorerNodes={explorerNodes}
      isBridgeAvailable={isBridgeAvailable}
      onOpenFile={() => runCommand("open-file")}
      onOpenFolder={() => runCommand("open-folder")}
      onThemePreferenceChange={setThemePreference}
      onToggleMode={() => runCommand("toggle-mode")}
      onToggleTheme={() =>
        setThemePreference(resolvedTheme === "dark" ? "light" : "dark")
      }
      resolvedTheme={resolvedTheme}
      statusMetrics={statusMetrics}
      themePreference={themePreference}
      workspaceLabel={workspaceLabel}
      workspacePath={workspacePath}
    />
  );
}
