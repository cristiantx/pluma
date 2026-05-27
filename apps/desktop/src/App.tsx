import { useEffect, useState } from "react";

import {
  type EditorTab,
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
  getExplorerNodes,
  getOpenTabs,
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
  const [openTabs, setOpenTabs] = useState<EditorTab[]>(() =>
    getOpenTabs(initialShellState)
  );
  const [activeTabId, setActiveTabId] = useState(() => openTabs[0]?.id ?? "");

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
    setOpenTabs((currentTabs) => {
      if (currentTabs.length > 0) {
        return currentTabs;
      }

      return getOpenTabs(shellState);
    });
  }, [shellState]);

  useEffect(() => {
    if (!openTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(openTabs[0]?.id ?? "");
    }
  }, [activeTabId, openTabs]);

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
  const workspacePath = shellState.activeFolder ?? "~/Documents/Pluma Docs";

  const handleTabClose = (tabId: string) => {
    setOpenTabs((currentTabs) => {
      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

      if (activeTabId === tabId) {
        setActiveTabId(nextTabs[0]?.id ?? "");
      }

      return nextTabs;
    });
  };

  return (
    <PlumaShell
      activeTabId={activeTabId}
      explorerNodes={explorerNodes}
      isBridgeAvailable={isBridgeAvailable}
      onActiveTabChange={setActiveTabId}
      onOpenFile={() => runCommand("open-file")}
      onOpenFolder={() => runCommand("open-folder")}
      onTabClose={handleTabClose}
      onToggleMode={() => runCommand("toggle-mode")}
      onToggleTheme={() =>
        setThemePreference(resolvedTheme === "dark" ? "light" : "dark")
      }
      onTabsReorder={setOpenTabs}
      resolvedTheme={resolvedTheme}
      statusMetrics={statusMetrics}
      tabs={openTabs}
      workspaceLabel={workspaceLabel}
      workspacePath={workspacePath}
    />
  );
}
