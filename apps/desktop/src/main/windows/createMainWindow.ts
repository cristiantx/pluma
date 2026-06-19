import { BrowserWindow } from "electron";
import path from "node:path";

export type CreateMainWindowOptions = {
  appIconPath: string;
  mainBundleDirectory: string;
  rendererDevServerUrl: string | undefined;
  rendererName: string;
  onClose: (event: Electron.Event) => void;
  onClosed: () => void;
  onLoaded: () => void;
  spellcheckEnabled: boolean;
};

export function createMainWindow(
  options: CreateMainWindowOptions
): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Pluma",
    icon: options.appIconPath,
    backgroundColor: "#f3ecdf",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(options.mainBundleDirectory, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: options.spellcheckEnabled
    }
  });

  if (options.rendererDevServerUrl) {
    void window.loadURL(options.rendererDevServerUrl);
  } else {
    void window.loadFile(
      path.join(
        options.mainBundleDirectory,
        `../renderer/${options.rendererName}/index.html`
      )
    );
  }

  window.on("closed", options.onClosed);
  window.on("close", options.onClose);
  window.webContents.on("did-finish-load", options.onLoaded);

  return window;
}
