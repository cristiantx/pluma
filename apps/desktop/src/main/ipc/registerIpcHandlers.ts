import { ipcMain, type IpcMainInvokeEvent } from "electron";

import type { AppSettings } from "@pluma/ui";
import type {
  CommandName,
  EditorViewMode,
  WorkspaceSearchMatch,
  WorkspaceSearchOptions
} from "../../shared/shellState";

export type DesktopIpcHandlers = {
  closeTab: (event: IpcMainInvokeEvent, tabId: string) => Promise<void>;
  getSettings: (event: IpcMainInvokeEvent) => Promise<AppSettings>;
  openAppDataFolder: (event: IpcMainInvokeEvent) => Promise<void>;
  openSettingsFile: (event: IpcMainInvokeEvent) => Promise<void>;
  openWorkspaceFile: (
    event: IpcMainInvokeEvent,
    filePath: unknown
  ) => Promise<void>;
  runCommand: (
    event: IpcMainInvokeEvent,
    command: CommandName
  ) => Promise<void>;
  searchWorkspace: (
    event: IpcMainInvokeEvent,
    query: unknown,
    folderPath: unknown,
    options: unknown
  ) => Promise<WorkspaceSearchMatch[]>;
  setActiveDocument: (event: IpcMainInvokeEvent, documentId: unknown) => void;
  setEditorMode: (event: IpcMainInvokeEvent, mode: unknown) => void;
  resetSettings: (event: IpcMainInvokeEvent) => Promise<AppSettings>;
  showTabContextMenu: (event: IpcMainInvokeEvent, tabId: string) => void;
  showWorkspaceContextMenu: (
    event: IpcMainInvokeEvent,
    targetPath: unknown,
    kind: unknown
  ) => void;
  updateDocumentText: (
    event: IpcMainInvokeEvent,
    documentId: unknown,
    rawText: unknown
  ) => void;
  updatePaneSizes: (event: IpcMainInvokeEvent, paneSizes: unknown) => void;
  updateSettings: (
    event: IpcMainInvokeEvent,
    settings: unknown
  ) => Promise<AppSettings>;
};

export function registerIpcHandlers(handlers: DesktopIpcHandlers): void {
  ipcMain.handle("pluma:command", async (event, command: CommandName) => {
    await handlers.runCommand(event, command);
  });

  ipcMain.handle("pluma:set-editor-mode", (event, mode: EditorViewMode) => {
    handlers.setEditorMode(event, mode);
  });

  ipcMain.handle("pluma:set-active-document", (event, documentId: unknown) => {
    handlers.setActiveDocument(event, documentId);
  });

  ipcMain.handle(
    "pluma:open-workspace-file",
    async (event, filePath: unknown) => {
      await handlers.openWorkspaceFile(event, filePath);
    }
  );

  ipcMain.handle(
    "pluma:search-workspace",
    async (
      event,
      query: unknown,
      folderPath: unknown,
      options: WorkspaceSearchOptions
    ) => handlers.searchWorkspace(event, query, folderPath, options)
  );

  ipcMain.handle("pluma:close-tab", async (event, tabId: string) => {
    await handlers.closeTab(event, tabId);
  });

  ipcMain.handle("pluma:show-tab-context-menu", (event, tabId: string) => {
    handlers.showTabContextMenu(event, tabId);
  });

  ipcMain.handle(
    "pluma:show-workspace-context-menu",
    (event, targetPath: unknown, kind: unknown) => {
      handlers.showWorkspaceContextMenu(event, targetPath, kind);
    }
  );

  ipcMain.handle("pluma:update-pane-sizes", (event, paneSizes: unknown) => {
    handlers.updatePaneSizes(event, paneSizes);
  });

  ipcMain.handle(
    "pluma:update-document-text",
    (event, documentId: unknown, rawText: unknown) => {
      handlers.updateDocumentText(event, documentId, rawText);
    }
  );

  ipcMain.handle("pluma:get-settings", async (event) =>
    handlers.getSettings(event)
  );

  ipcMain.handle("pluma:open-app-data-folder", async (event) => {
    await handlers.openAppDataFolder(event);
  });

  ipcMain.handle("pluma:open-settings-file", async (event) => {
    await handlers.openSettingsFile(event);
  });

  ipcMain.handle("pluma:reset-settings", async (event) =>
    handlers.resetSettings(event)
  );

  ipcMain.handle("pluma:update-settings", async (event, settings: unknown) =>
    handlers.updateSettings(event, settings)
  );
}
