import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  type MenuItemConstructorOptions
} from "electron";
import path from "node:path";

import started from "electron-squirrel-startup";
import type { CommandName, EditorMode, RendererEvent } from "./shell-state";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let currentMode: EditorMode = "rich";

if (started) {
  app.quit();
}

function emitToRenderer(event: RendererEvent): void {
  mainWindow?.webContents.send("pluma:event", event);
}

async function handleCommand(command: CommandName): Promise<void> {
  if (!mainWindow) {
    return;
  }

  switch (command) {
    case "open-file": {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }]
      });

      if (result.canceled || result.filePaths.length === 0) {
        emitToRenderer({ type: "status", message: "Open file cancelled." });
        return;
      }

      const selectedPath = result.filePaths[0];
      if (!selectedPath) {
        emitToRenderer({
          type: "status",
          message: "Open file did not return a path."
        });
        return;
      }

      emitToRenderer({ type: "file-opened", path: selectedPath });
      return;
    }
    case "open-folder": {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"]
      });

      if (result.canceled || result.filePaths.length === 0) {
        emitToRenderer({ type: "status", message: "Open folder cancelled." });
        return;
      }

      const selectedPath = result.filePaths[0];
      if (!selectedPath) {
        emitToRenderer({
          type: "status",
          message: "Open folder did not return a path."
        });
        return;
      }

      emitToRenderer({ type: "folder-opened", path: selectedPath });
      return;
    }
    case "save":
      emitToRenderer({ type: "save-requested" });
      return;
    case "save-as":
      emitToRenderer({ type: "save-as-requested" });
      return;
    case "toggle-mode":
      currentMode = currentMode === "rich" ? "source" : "rich";
      emitToRenderer({ type: "mode-changed", mode: currentMode });
      return;
  }
}

function buildMenu(): Menu {
  const windowSubmenu: MenuItemConstructorOptions[] =
    process.platform === "darwin"
      ? [{ role: "minimize" }, { role: "zoom" }, { role: "front" }]
      : [{ role: "minimize" }, { role: "zoom" }, { role: "close" }];

  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open File",
          accelerator: "CmdOrCtrl+O",
          click: () => void handleCommand("open-file")
        },
        {
          label: "Open Folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => void handleCommand("open-folder")
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => void handleCommand("save")
        },
        {
          label: "Save As",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => void handleCommand("save-as")
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Rich/Source Mode",
          accelerator: "CmdOrCtrl+\\",
          click: () => void handleCommand("toggle-mode")
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" }
      ]
    },
    {
      label: "Window",
      submenu: windowSubmenu
    }
  ]);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Pluma",
    backgroundColor: "#f3ecdf",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    emitToRenderer({ type: "mode-changed", mode: currentMode });
    emitToRenderer({
      type: "status",
      message:
        "Desktop shell ready. File I/O and document sessions land in Phase 2."
    });
  });
}

ipcMain.handle("pluma:command", async (_event, command: CommandName) => {
  await handleCommand(command);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu());
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
