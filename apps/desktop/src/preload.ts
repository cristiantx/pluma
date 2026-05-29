import { contextBridge, ipcRenderer } from "electron";
import type { CommandName, RendererEvent } from "./shellState";

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
  runCommand(command: CommandName) {
    return ipcRenderer.invoke("pluma:command", command);
  },
  updateSettings(settings: unknown) {
    return ipcRenderer.invoke("pluma:update-settings", settings);
  },
  updatePaneSizes(paneSizes: number[]) {
    return ipcRenderer.invoke("pluma:update-pane-sizes", paneSizes);
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
