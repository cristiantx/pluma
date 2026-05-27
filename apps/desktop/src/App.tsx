import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  type PlumaCommandHandlers,
  type PlumaShellSnapshot,
  PlumaShell,
  initialPlumaStoreState,
  readStoredThemePreference,
  THEME_STORAGE_KEY,
  usePlumaStore
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

function getInitialThemePreference() {
  if (typeof window === "undefined") {
    return "system";
  }

  return readStoredThemePreference(
    window.localStorage.getItem(THEME_STORAGE_KEY)
  );
}

export function App() {
  const [shellState, setShellState] = useState(initialShellState);
  const themePreference = usePlumaStore((state) => state.theme.preference);
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const hydrateShellSnapshot = usePlumaStore(
    (state) => state.hydrateShellSnapshot
  );
  const setCommandHandlers = usePlumaStore((state) => state.setCommandHandlers);
  const setSystemPrefersDark = usePlumaStore(
    (state) => state.setSystemPrefersDark
  );
  const setThemePreference = usePlumaStore((state) => state.setThemePreference);

  useEffect(() => {
    usePlumaStore.setState({
      ...usePlumaStore.getState(),
      ...initialPlumaStoreState
    });
  }, []);

  useEffect(() => {
    const commandHandlers: PlumaCommandHandlers = {
      openFile: () => runCommand(setShellState, "open-file"),
      openFolder: () => runCommand(setShellState, "open-folder"),
      toggleMode: () => runCommand(setShellState, "toggle-mode")
    };

    setCommandHandlers(commandHandlers);

    if (!window.pluma) {
      setShellState((current) => ({
        ...current,
        status: "Renderer loaded without preload bridge."
      }));
      return;
    }

    return window.pluma.onEvent((event) => {
      setShellState((current) => reduceShellEvent(current, event));
    });
  }, [setCommandHandlers]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    setSystemPrefersDark(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [setSystemPrefersDark]);

  useEffect(() => {
    setThemePreference(getInitialThemePreference());
  }, [setThemePreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    hydrateShellSnapshot(getShellSnapshot(shellState, Boolean(window.pluma)));
  }, [hydrateShellSnapshot, shellState]);

  return <PlumaShell />;
}

function getShellSnapshot(
  shellState: typeof initialShellState,
  isBridgeAvailable: boolean
): PlumaShellSnapshot {
  return {
    explorerNodes: getExplorerNodes(shellState),
    hasWorkspace: Boolean(shellState.activeFolder),
    isBridgeAvailable,
    statusMetrics: getStatusMetrics(shellState),
    tabs: getOpenTabs(shellState),
    workspaceLabel: getWorkspaceLabel(shellState),
    workspacePath: shellState.activeFolder ?? "~/Documents/Pluma Docs"
  };
}

function runCommand(
  setShellState: Dispatch<SetStateAction<typeof initialShellState>>,
  command: CommandName
) {
  if (!window.pluma) {
    setShellState((current) => ({
      ...current,
      status: `Cannot run "${command}" because IPC is unavailable.`
    }));
    return;
  }

  void window.pluma.runCommand(command);
}
