import {
  defaultAppSettings,
  usePlumaStore,
  type AppSettings,
  type PlumaCommandHandlers
} from "@pluma/ui";

import type {
  CommandName,
  EditorViewMode,
  WorkspaceSearchOptions
} from "../shared/shellState";

type CreatePlumaCommandHandlersOptions = {
  schedulePaneSizesSave: (paneSizes: number[]) => void;
};

export function createPlumaCommandHandlers({
  schedulePaneSizesSave
}: CreatePlumaCommandHandlersOptions): PlumaCommandHandlers {
  return {
    closeTab: (tabId) =>
      invokePlumaOrNotify(
        `Cannot close "${tabId}" because IPC is unavailable.`,
        (pluma) => pluma.closeTab(tabId)
      ),
    keepEditing: () => runCommand("keep-editing"),
    newFile: () => runCommand("new-file"),
    openDevTools: () => runCommand("open-devtools"),
    openAppDataFolder: () =>
      invokePlumaOrNotify(
        "Cannot open app data because IPC is unavailable.",
        (pluma) => pluma.openAppDataFolder()
      ),
    openExternalUrl: (url) =>
      invokePlumaOrNotify(
        `Cannot open "${url}" because IPC is unavailable.`,
        (pluma) => pluma.openExternalUrl(url)
      ),
    openFile: () => runCommand("open-file"),
    openFolder: () => runCommand("open-folder"),
    openSettingsFile: () =>
      invokePlumaOrNotify(
        "Cannot open settings because IPC is unavailable.",
        (pluma) => pluma.openSettingsFile()
      ),
    openWorkspaceFile: (path) =>
      invokePlumaOrNotify(
        `Cannot open "${path}" because IPC is unavailable.`,
        (pluma) => pluma.openWorkspaceFile(path)
      ),
    searchWorkspace: runSearchWorkspace,
    updateSettings: runUpdateSettings,
    reloadFromDisk: () => runCommand("reload-from-disk"),
    resetSettings: runResetSettings,
    setActiveTabId: (tabId) =>
      invokePlumaOrNotify(
        `Cannot activate "${tabId}" because IPC is unavailable.`,
        (pluma) => pluma.setActiveTab(tabId)
      ),
    setEditorViewMode: (mode) => runSetEditorViewMode(mode),
    showTabContextMenu: (tabId, tabIds) =>
      invokePlumaOrNotify(
        `Cannot show tab menu for "${tabId}" because IPC is unavailable.`,
        (pluma) => pluma.showTabContextMenu(tabId, tabIds)
      ),
    showWorkspaceContextMenu: (path, kind) =>
      invokePlumaOrNotify(
        `Cannot show file menu for "${path}" because IPC is unavailable.`,
        (pluma) => pluma.showWorkspaceContextMenu(path, kind)
      ),
    updateDocumentText: (documentId, rawText) =>
      invokePlumaOrNotify(
        `Cannot update "${documentId}" because IPC is unavailable.`,
        (pluma) => pluma.updateDocumentText(documentId, rawText)
      ),
    updatePaneSizes: schedulePaneSizesSave,
    toggleMode: () => runCommand("toggle-mode")
  };
}

function runResetSettings(): Promise<AppSettings> {
  if (!window.pluma) {
    notifyError("Cannot reset settings because IPC is unavailable.");
    return Promise.resolve(defaultAppSettings);
  }

  return window.pluma.resetSettings().catch((error: unknown) => {
    notifyError(`Could not reset settings: ${getErrorMessage(error)}`);
    return usePlumaStore.getState().settings;
  });
}

function runUpdateSettings(
  settings: Partial<AppSettings>
): Promise<AppSettings> {
  if (!window.pluma) {
    notifyError("Cannot update settings because IPC is unavailable.");
    return Promise.resolve({ ...defaultAppSettings, ...settings });
  }

  return window.pluma.updateSettings(settings).catch((error: unknown) => {
    notifyError(`Could not update settings: ${getErrorMessage(error)}`);
    return usePlumaStore.getState().settings;
  });
}

function runCommand(command: CommandName): void {
  invokePlumaOrNotify(
    `Cannot run "${command}" because IPC is unavailable.`,
    (pluma) => pluma.runCommand(command)
  );
}

function runSearchWorkspace(
  query: string,
  folderPath: string | null,
  options: WorkspaceSearchOptions
) {
  if (!window.pluma) {
    notifyError("Cannot search the workspace because IPC is unavailable.");
    return Promise.resolve([]);
  }

  return window.pluma
    .searchWorkspace(query, folderPath, options)
    .catch((error: unknown) => {
      notifyError(`Workspace search failed: ${getErrorMessage(error)}`);
      return [];
    });
}

function runSetEditorViewMode(mode: EditorViewMode): void {
  invokePlumaOrNotify(
    `Cannot switch to ${mode} mode because IPC is unavailable.`,
    (pluma) => pluma.setEditorMode(mode)
  );
}

function invokePlumaOrNotify(
  fallbackMessage: string,
  invoke: (pluma: NonNullable<typeof window.pluma>) => unknown
): void {
  if (!window.pluma) {
    notifyError(fallbackMessage);
    return;
  }

  try {
    void Promise.resolve(invoke(window.pluma)).catch((error: unknown) => {
      notifyError(`${fallbackMessage} ${getErrorMessage(error)}`);
    });
  } catch (error) {
    notifyError(`${fallbackMessage} ${getErrorMessage(error)}`);
  }
}

function notifyError(message: string): void {
  usePlumaStore.getState().pushNotification(message, "error");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
