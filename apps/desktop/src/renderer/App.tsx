import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  type EditorViewMode,
  type PlumaCommandHandlers,
  PlumaShell,
  initialPlumaStoreState,
  usePlumaStore
} from "@pluma/ui";
import {
  initialShellState,
  reduceShellEvent,
  type CommandName
} from "../shared/shellState";
import { getShellSnapshot } from "./shellView";

export function App() {
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [shellState, setShellState] = useState(initialShellState);
  const themePreference = usePlumaStore((state) => state.theme.preference);
  const lastPersistedThemePreference = useRef(themePreference);
  const paneSizeSaveTimeout = useRef<number | null>(null);
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const hydrateShellSnapshot = usePlumaStore(
    (state) => state.hydrateShellSnapshot
  );
  const setCommandHandlers = usePlumaStore((state) => state.setCommandHandlers);
  const setSystemPrefersDark = usePlumaStore(
    (state) => state.setSystemPrefersDark
  );
  const setThemePreference = usePlumaStore((state) => state.setThemePreference);

  const schedulePaneSizesSave = useCallback((paneSizes: number[]) => {
    if (!window.pluma) {
      return;
    }

    if (paneSizeSaveTimeout.current) {
      window.clearTimeout(paneSizeSaveTimeout.current);
    }

    const nextPaneSizes = [...paneSizes];

    paneSizeSaveTimeout.current = window.setTimeout(() => {
      paneSizeSaveTimeout.current = null;
      void window.pluma.updatePaneSizes(nextPaneSizes);
    }, 250);
  }, []);

  useEffect(() => {
    usePlumaStore.setState({
      ...usePlumaStore.getState(),
      ...initialPlumaStoreState
    });
  }, []);

  useEffect(() => {
    const commandHandlers: PlumaCommandHandlers = {
      closeTab: (tabId) => runCloseTabCommand(setShellState, tabId),
      compareConflict: () => runCommand(setShellState, "compare-conflict"),
      keepEditing: () => runCommand(setShellState, "keep-editing"),
      newFile: () => runCommand(setShellState, "new-file"),
      openDevTools: () => runCommand(setShellState, "open-devtools"),
      openFile: () => runCommand(setShellState, "open-file"),
      openFolder: () => runCommand(setShellState, "open-folder"),
      openWorkspaceFile: (path) => runWorkspaceFileCommand(setShellState, path),
      reloadFromDisk: () => runCommand(setShellState, "reload-from-disk"),
      setActiveTabId: (tabId) => runSetActiveTabCommand(setShellState, tabId),
      setEditorViewMode: (mode) => runSetEditorViewMode(setShellState, mode),
      updateDocumentText: (documentId, rawText) =>
        runUpdateDocumentText(setShellState, documentId, rawText),
      updatePaneSizes: schedulePaneSizesSave,
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
  }, [schedulePaneSizesSave, setCommandHandlers]);

  useEffect(() => {
    return () => {
      if (paneSizeSaveTimeout.current) {
        window.clearTimeout(paneSizeSaveTimeout.current);
      }
    };
  }, []);

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
    if (!window.pluma) {
      setSettingsLoaded(true);
      return;
    }

    let isActive = true;

    void window.pluma.getSettings().then((settings) => {
      if (!isActive) {
        return;
      }

      setThemePreference(settings.themePreference);
      lastPersistedThemePreference.current = settings.themePreference;
      setSettingsLoaded(true);
    });

    return () => {
      isActive = false;
    };
  }, [setThemePreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;

    if (!settingsLoaded || !window.pluma) {
      return;
    }

    if (lastPersistedThemePreference.current === themePreference) {
      return;
    }

    lastPersistedThemePreference.current = themePreference;
    void window.pluma.updateSettings({ themePreference });
  }, [resolvedTheme, settingsLoaded, themePreference]);

  useEffect(() => {
    hydrateShellSnapshot(getShellSnapshot(shellState, Boolean(window.pluma)));
  }, [hydrateShellSnapshot, shellState]);

  return <PlumaShell />;
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

function runWorkspaceFileCommand(
  setShellState: Dispatch<SetStateAction<typeof initialShellState>>,
  filePath: string
) {
  if (!window.pluma) {
    setShellState((current) => ({
      ...current,
      status: `Cannot open "${filePath}" because IPC is unavailable.`
    }));
    return;
  }

  void window.pluma.openWorkspaceFile(filePath);
}

function runSetEditorViewMode(
  setShellState: Dispatch<SetStateAction<typeof initialShellState>>,
  mode: EditorViewMode
) {
  if (!window.pluma) {
    setShellState((current) => ({
      ...current,
      mode,
      status: `Editor mode switched to ${mode}.`
    }));
    return;
  }

  void window.pluma.setEditorMode(mode);
}

function runSetActiveTabCommand(
  setShellState: Dispatch<SetStateAction<typeof initialShellState>>,
  tabId: string
) {
  setShellState((current) => {
    if (!current.documents.some((document) => document.id === tabId)) {
      return current;
    }

    return {
      ...current,
      activeDocumentId: tabId
    };
  });

  if (!window.pluma) {
    return;
  }

  void window.pluma.setActiveDocument(tabId);
}

function runUpdateDocumentText(
  setShellState: Dispatch<SetStateAction<typeof initialShellState>>,
  documentId: string,
  rawText: string
) {
  if (!window.pluma) {
    setShellState((current) => ({
      ...current,
      status: `Cannot update "${documentId}" because IPC is unavailable.`
    }));
    return;
  }

  void window.pluma.updateDocumentText(documentId, rawText);
}

function runCloseTabCommand(
  setShellState: Dispatch<SetStateAction<typeof initialShellState>>,
  tabId: string
) {
  if (!window.pluma) {
    setShellState((current) => ({
      ...current,
      status: `Cannot close "${tabId}" because IPC is unavailable.`
    }));
    return;
  }

  void window.pluma.closeTab(tabId);
}
