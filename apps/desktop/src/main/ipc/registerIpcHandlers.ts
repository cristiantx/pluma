import { ipcMain } from "electron";

import type { AppSettings } from "../persistence/appPersistence";
import type {
  CommandName,
  EditorViewMode,
  WorkspaceSearchMatch,
  WorkspaceSearchOptions
} from "../../shared/shellState";

export type DesktopIpcHandlers = {
  closeTab: (tabId: string) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  openWorkspaceFile: (filePath: string) => Promise<void>;
  runCommand: (command: CommandName) => Promise<void>;
  searchWorkspace: (
    query: unknown,
    folderPath: unknown,
    options: unknown
  ) => Promise<WorkspaceSearchMatch[]>;
  setActiveDocument: (documentId: unknown) => void;
  setEditorMode: (mode: unknown) => void;
  showTabContextMenu: (tabId: string) => void;
  showWorkspaceContextMenu: (targetPath: unknown, kind: unknown) => void;
  updateDocumentText: (documentId: unknown, rawText: unknown) => void;
  updatePaneSizes: (paneSizes: unknown) => void;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
};

export function registerIpcHandlers(handlers: DesktopIpcHandlers): void {
  ipcMain.handle("pluma:command", async (_event, command: CommandName) => {
    await handlers.runCommand(command);
  });

  ipcMain.handle("pluma:set-editor-mode", (_event, mode: EditorViewMode) => {
    handlers.setEditorMode(mode);
  });

  ipcMain.handle("pluma:set-active-document", (_event, documentId: unknown) => {
    handlers.setActiveDocument(documentId);
  });

  ipcMain.handle(
    "pluma:open-workspace-file",
    async (_event, filePath: string) => {
      await handlers.openWorkspaceFile(filePath);
    }
  );

  ipcMain.handle(
    "pluma:search-workspace",
    async (
      _event,
      query: unknown,
      folderPath: unknown,
      options: WorkspaceSearchOptions
    ) => handlers.searchWorkspace(query, folderPath, options)
  );

  ipcMain.handle("pluma:close-tab", async (_event, tabId: string) => {
    await handlers.closeTab(tabId);
  });

  ipcMain.handle("pluma:show-tab-context-menu", (_event, tabId: string) => {
    handlers.showTabContextMenu(tabId);
  });

  ipcMain.handle(
    "pluma:show-workspace-context-menu",
    (_event, targetPath: unknown, kind: unknown) => {
      handlers.showWorkspaceContextMenu(targetPath, kind);
    }
  );

  ipcMain.handle("pluma:update-pane-sizes", (_event, paneSizes: unknown) => {
    handlers.updatePaneSizes(paneSizes);
  });

  ipcMain.handle(
    "pluma:update-document-text",
    (_event, documentId: unknown, rawText: unknown) => {
      handlers.updateDocumentText(documentId, rawText);
    }
  );

  ipcMain.handle("pluma:get-settings", async () => handlers.getSettings());

  ipcMain.handle(
    "pluma:update-settings",
    async (_event, settings: Partial<AppSettings>) =>
      handlers.updateSettings(settings)
  );
}
