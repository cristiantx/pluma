import { contextBridge, ipcRenderer } from "electron";
import type { CommandName, RendererEvent } from "./shellState";

const api = {
  runCommand(command: CommandName) {
    return ipcRenderer.invoke("pluma:command", command);
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
