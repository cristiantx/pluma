import { contextBridge, ipcRenderer } from "electron";
import type {
  CommandName,
  EditorViewMode,
  RendererEvent,
  WorkspaceSearchOptions
} from "./shared/shellState";

const api = {
  closeTab(tabId: string) {
    return ipcRenderer.invoke("pluma:close-tab", tabId);
  },
  getSettings() {
    return ipcRenderer.invoke("pluma:get-settings");
  },
  openWorkspaceFile(path: string) {
    return ipcRenderer.invoke("pluma:open-workspace-file", path);
  },
  openAppDataFolder() {
    return ipcRenderer.invoke("pluma:open-app-data-folder");
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
    return ipcRenderer.invoke("pluma:command", command);
  },
  setEditorMode(mode: EditorViewMode) {
    return ipcRenderer.invoke("pluma:set-editor-mode", mode);
  },
  setActiveDocument(documentId: string) {
    return ipcRenderer.invoke("pluma:set-active-document", documentId);
  },
  setActiveTab(tabId: string) {
    return ipcRenderer.invoke("pluma:set-active-tab", tabId);
  },
  showTabContextMenu(tabId: string, tabIds: string[]) {
    return ipcRenderer.invoke("pluma:show-tab-context-menu", tabId, tabIds);
  },
  showWorkspaceContextMenu(path: string, kind: string) {
    return ipcRenderer.invoke("pluma:show-workspace-context-menu", path, kind);
  },
  updateSettings(settings: unknown) {
    return ipcRenderer.invoke("pluma:update-settings", settings);
  },
  updatePaneSizes(paneSizes: number[]) {
    return ipcRenderer.invoke("pluma:update-pane-sizes", paneSizes);
  },
  updateDocumentText(documentId: string, rawText: string) {
    return ipcRenderer.invoke(
      "pluma:update-document-text",
      documentId,
      rawText
    );
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

contextBridge.exposeInMainWorld("pluma", api);
