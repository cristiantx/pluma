import type { Dispatch, SetStateAction } from "react";

import type { PlumaCommandHandlers } from "@pluma/ui";

import type {
  CommandName,
  EditorViewMode,
  initialShellState,
  WorkspaceSearchOptions
} from "../shared/shellState";

type ShellStateSetter = Dispatch<SetStateAction<typeof initialShellState>>;

type CreatePlumaCommandHandlersOptions = {
  schedulePaneSizesSave: (paneSizes: number[]) => void;
  setShellState: ShellStateSetter;
};

export function createPlumaCommandHandlers({
  schedulePaneSizesSave,
  setShellState
}: CreatePlumaCommandHandlersOptions): PlumaCommandHandlers {
  return {
    closeTab: (tabId) =>
      invokePlumaOrSetStatus(
        setShellState,
        `Cannot close "${tabId}" because IPC is unavailable.`,
        (pluma) => void pluma.closeTab(tabId)
      ),
    compareConflict: () => runCommand(setShellState, "compare-conflict"),
    keepEditing: () => runCommand(setShellState, "keep-editing"),
    newFile: () => runCommand(setShellState, "new-file"),
    openDevTools: () => runCommand(setShellState, "open-devtools"),
    openAppDataFolder: () =>
      invokePlumaOrSetStatus(
        setShellState,
        "Cannot open app data because IPC is unavailable.",
        (pluma) => void pluma.openAppDataFolder()
      ),
    openExternalUrl: (url) =>
      invokePlumaOrSetStatus(
        setShellState,
        `Cannot open "${url}" because IPC is unavailable.`,
        (pluma) => void pluma.openExternalUrl(url)
      ),
    openFile: () => runCommand(setShellState, "open-file"),
    openFolder: () => runCommand(setShellState, "open-folder"),
    openSettingsFile: () =>
      invokePlumaOrSetStatus(
        setShellState,
        "Cannot open settings because IPC is unavailable.",
        (pluma) => void pluma.openSettingsFile()
      ),
    openWorkspaceFile: (path) =>
      invokePlumaOrSetStatus(
        setShellState,
        `Cannot open "${path}" because IPC is unavailable.`,
        (pluma) => void pluma.openWorkspaceFile(path)
      ),
    searchWorkspace: (query, folderPath, options) =>
      runSearchWorkspace(query, folderPath, options),
    updateSettings: (settings) => runUpdateSettings(settings),
    reloadFromDisk: () => runCommand(setShellState, "reload-from-disk"),
    resetSettings: () => runResetSettings(),
    setActiveTabId: (tabId) => runSetActiveTabCommand(setShellState, tabId),
    setEditorViewMode: (mode) => runSetEditorViewMode(setShellState, mode),
    showTabContextMenu: (tabId, tabIds) =>
      invokePlumaOrSetStatus(
        setShellState,
        `Cannot show tab menu for "${tabId}" because IPC is unavailable.`,
        (pluma) => void pluma.showTabContextMenu(tabId, tabIds)
      ),
    showWorkspaceContextMenu: (path, kind) =>
      invokePlumaOrSetStatus(
        setShellState,
        `Cannot show file menu for "${path}" because IPC is unavailable.`,
        (pluma) => void pluma.showWorkspaceContextMenu(path, kind)
      ),
    updateDocumentText: (documentId, rawText) =>
      invokePlumaOrSetStatus(
        setShellState,
        `Cannot update "${documentId}" because IPC is unavailable.`,
        (pluma) => void pluma.updateDocumentText(documentId, rawText)
      ),
    updatePaneSizes: schedulePaneSizesSave,
    toggleMode: () => runCommand(setShellState, "toggle-mode")
  };
}

function runResetSettings() {
  if (!window.pluma) {
    return Promise.resolve(useFallbackSettings({}));
  }

  return window.pluma.resetSettings();
}

function runUpdateSettings(
  settings: Parameters<NonNullable<typeof window.pluma>["updateSettings"]>[0]
) {
  if (!window.pluma) {
    return Promise.resolve(useFallbackSettings(settings));
  }

  return window.pluma.updateSettings(settings);
}

function useFallbackSettings(
  settings: Parameters<NonNullable<typeof window.pluma>["updateSettings"]>[0]
) {
  return {
    autosaveEnabled: true,
    defaultLineEnding: "system" as const,
    openExportedFile: false,
    richEditorDensity: "comfortable" as const,
    richEditorWidth: "default" as const,
    restorePreviousSession: true,
    sourceEditorColorScheme: "follow-theme" as const,
    sourceEditorFontFamily: "mono" as const,
    sourceEditorFontSize: 14 as const,
    sourceEditorLineNumbers: true,
    sourceEditorTabSize: 2 as const,
    sourceEditorWordWrap: true,
    sourceEditorWidth: "default" as const,
    spellcheckEnabled: true,
    themePreference: "system" as const,
    workspaceSearchCaseSensitive: false,
    workspaceSearchRegexp: false,
    workspaceSearchWholeWord: false,
    workspaceShowHiddenFiles: true,
    ...settings
  };
}

function runCommand(
  setShellState: ShellStateSetter,
  command: CommandName
): void {
  invokePlumaOrSetStatus(
    setShellState,
    `Cannot run "${command}" because IPC is unavailable.`,
    (pluma) => void pluma.runCommand(command)
  );
}

function runSearchWorkspace(
  query: string,
  folderPath: string | null,
  options: WorkspaceSearchOptions
) {
  if (!window.pluma) {
    return Promise.resolve([]);
  }

  return window.pluma.searchWorkspace(query, folderPath, options);
}

function runSetEditorViewMode(
  setShellState: ShellStateSetter,
  mode: EditorViewMode
): void {
  if (!window.pluma) {
    setShellState((current) => ({
      ...current,
      mode,
      status: `Editor mode switched to ${mode}.`
    }));
    return;
  }

  setShellState((current) => ({
    ...current,
    documentViewModes: current.activeDocumentId
      ? {
          ...current.documentViewModes,
          [current.activeDocumentId]: mode
        }
      : current.documentViewModes,
    mode,
    status: `Editor mode switched to ${mode}.`
  }));
  void window.pluma.setEditorMode(mode);
}

function runSetActiveTabCommand(
  setShellState: ShellStateSetter,
  tabId: string
): void {
  if (tabId === "settings") {
    setShellState((current) => ({
      ...current,
      activeTabId: "settings"
    }));
    void window.pluma?.setActiveTab(tabId);
    return;
  }

  setShellState((current) => {
    if (!current.documents.some((document) => document.id === tabId)) {
      return current;
    }
    const mode = current.documentViewModes[tabId] ?? current.mode;

    return {
      ...current,
      activeDocumentId: tabId,
      activeTabId: tabId,
      mode
    };
  });

  if (!window.pluma) {
    return;
  }

  void window.pluma.setActiveTab(tabId);
}

function invokePlumaOrSetStatus(
  setShellState: ShellStateSetter,
  fallbackStatus: string,
  invoke: (pluma: NonNullable<typeof window.pluma>) => void
): void {
  if (!window.pluma) {
    setShellState((current) => ({
      ...current,
      status: fallbackStatus
    }));
    return;
  }

  invoke(window.pluma);
}
