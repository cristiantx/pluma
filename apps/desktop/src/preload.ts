import { contextBridge, ipcRenderer } from "electron";
import type {
  CommandName,
  EditorViewMode,
  RendererEvent,
  WorkspaceSearchOptions
} from "./shared/shellState";
import { PendingDocumentTextSync } from "./preload/documentTextSync";

const pendingDocumentText = new PendingDocumentTextSync(
  (documentId, rawText) => {
    ipcRenderer.send("pluma:update-document-text", documentId, rawText);
  }
);

function invokeAfterDocumentTextFlush(
  channel: string,
  ...args: unknown[]
): Promise<unknown> {
  pendingDocumentText.flush();
  return ipcRenderer.invoke(channel, ...args);
}

const api = {
  closeTab(tabId: string) {
    return invokeAfterDocumentTextFlush("pluma:close-tab", tabId);
  },
  getSettings() {
    return ipcRenderer.invoke("pluma:get-settings");
  },
  openWorkspaceFile(path: string) {
    return invokeAfterDocumentTextFlush("pluma:open-workspace-file", path);
  },
  openAppDataFolder() {
    return ipcRenderer.invoke("pluma:open-app-data-folder");
  },
  openExternalUrl(url: string) {
    return ipcRenderer.invoke("pluma:open-external-url", url);
  },
  openSettingsFile() {
    return ipcRenderer.invoke("pluma:open-settings-file");
  },
  resetSettings() {
    return ipcRenderer.invoke("pluma:reset-settings");
  },
  searchWorkspace(
    query: string,
    folderPath: string | null,
    options: WorkspaceSearchOptions
  ) {
    return ipcRenderer.invoke(
      "pluma:search-workspace",
      query,
      folderPath,
      options
    );
  },
  runCommand(command: CommandName) {
    return invokeAfterDocumentTextFlush("pluma:command", command);
  },
  setEditorMode(mode: EditorViewMode) {
    return invokeAfterDocumentTextFlush("pluma:set-editor-mode", mode);
  },
  setActiveDocument(documentId: string) {
    return invokeAfterDocumentTextFlush(
      "pluma:set-active-document",
      documentId
    );
  },
  setActiveTab(tabId: string) {
    return invokeAfterDocumentTextFlush("pluma:set-active-tab", tabId);
  },
  showTabContextMenu(tabId: string, tabIds: string[]) {
    return invokeAfterDocumentTextFlush(
      "pluma:show-tab-context-menu",
      tabId,
      tabIds
    );
  },
  showWorkspaceContextMenu(path: string, kind: string) {
    return invokeAfterDocumentTextFlush(
      "pluma:show-workspace-context-menu",
      path,
      kind
    );
  },
  updateSettings(settings: unknown) {
    return ipcRenderer.invoke("pluma:update-settings", settings);
  },
  updatePaneSizes(paneSizes: number[]) {
    return ipcRenderer.invoke("pluma:update-pane-sizes", paneSizes);
  },
  updateDocumentText(documentId: string, rawText: string) {
    pendingDocumentText.schedule(documentId, rawText);
  },
  onEvent(listener: (event: RendererEvent) => void) {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: RendererEvent
    ) => {
      listener(payload);
    };

    ipcRenderer.on("pluma:event", wrapped);

    return () => {
      ipcRenderer.removeListener("pluma:event", wrapped);
    };
  }
};

ipcRenderer.on("pluma:flush-pending-document-text", (_event, requestId) => {
  pendingDocumentText.flush();
  ipcRenderer.send("pluma:document-text-flushed", requestId);
});

contextBridge.exposeInMainWorld("pluma", api);
