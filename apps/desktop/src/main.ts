import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  nativeImage,
  type MenuItemConstructorOptions
} from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";

import { createDocumentSession, type DesktopFileLocation } from "@pluma/core";
import { DesktopFileSystemAdapter } from "@pluma/core-desktop";
import started from "electron-squirrel-startup";
import type {
  CommandName,
  DesktopShellSnapshot,
  EditorMode,
  RendererEvent,
  WorkspaceTreeEntry
} from "./shellState";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let currentMode: EditorMode = "rich";
let pendingOpenTargets: string[] = [];
const fileSystem = new DesktopFileSystemAdapter();
let shellData: DesktopShellSnapshot = {
  activeDocumentId: null,
  documents: [],
  status: "Starting desktop shell...",
  workspaceEntries: [],
  workspacePath: null
};
const markdownExtensions = new Set([".md", ".markdown", ".mdown"]);

if (started) {
  app.quit();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

const appIconPath = path.resolve(__dirname, "../../assets/icon.png");

function setApplicationIcon(): void {
  const icon = nativeImage.createFromPath(appIconPath);

  if (icon.isEmpty()) {
    return;
  }

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }
}

function emitToRenderer(event: RendererEvent): void {
  mainWindow?.webContents.send("pluma:event", event);
}

function emitShellSnapshot(): void {
  emitToRenderer({
    type: "shell-snapshot",
    snapshot: shellData
  });
}

function updateShellData(
  update: Partial<DesktopShellSnapshot>
): DesktopShellSnapshot {
  shellData = {
    ...shellData,
    ...update
  };

  return shellData;
}

function isMarkdownFilePath(filePath: string): boolean {
  return markdownExtensions.has(path.extname(filePath).toLowerCase());
}

function isPathInsideDirectory(
  directoryPath: string,
  targetPath: string
): boolean {
  const relativePath = path.relative(directoryPath, targetPath);

  return (
    relativePath !== "" &&
    relativePath !== "." &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

function toDesktopFileLocation(filePath: string): DesktopFileLocation {
  return {
    kind: "desktop-path",
    path: filePath
  };
}

function mergeDocumentSession(
  nextSession: ReturnType<typeof createDocumentSession>
): void {
  const remainingDocuments = shellData.documents.filter(
    (document) => document.id !== nextSession.id
  );

  updateShellData({
    activeDocumentId: nextSession.id,
    documents: [nextSession, ...remainingDocuments]
  });
}

async function collectWorkspaceEntries(
  directoryPath: string,
  depth = 0
): Promise<WorkspaceTreeEntry[]> {
  const directoryEntries = await fileSystem.listDirectory(
    toDesktopFileLocation(directoryPath)
  );
  const workspaceEntries: WorkspaceTreeEntry[] = [];

  for (const directoryEntry of directoryEntries) {
    if (directoryEntry.kind === "directory") {
      const childEntries = await collectWorkspaceEntries(
        directoryEntry.location.path,
        depth + 1
      );

      if (childEntries.length === 0) {
        continue;
      }

      workspaceEntries.push({
        depth,
        kind: "folder",
        name: directoryEntry.name,
        path: directoryEntry.location.path
      });
      workspaceEntries.push(...childEntries);
      continue;
    }

    if (!isMarkdownFilePath(directoryEntry.location.path)) {
      continue;
    }

    workspaceEntries.push({
      depth,
      kind: "file",
      name: directoryEntry.name,
      path: directoryEntry.location.path
    });
  }

  return workspaceEntries;
}

async function openFilePath(
  filePath: string,
  options: {
    workspacePath?: string | null;
  } = {}
): Promise<void> {
  const fileLocation = toDesktopFileLocation(filePath);
  const metadata = await fileSystem.getMetadata(fileLocation);

  if (!metadata) {
    emitToRenderer({
      type: "status",
      message: `Could not read metadata for "${filePath}".`
    });
    return;
  }

  const rawText = await fileSystem.readText(fileLocation);
  const session = createDocumentSession({
    location: fileLocation,
    metadata,
    rawText
  });
  const workspacePath =
    options.workspacePath ??
    (shellData.workspacePath &&
    isPathInsideDirectory(shellData.workspacePath, filePath)
      ? shellData.workspacePath
      : null);

  mergeDocumentSession(session);
  updateShellData({
    status: `Opened ${path.basename(filePath)}.`,
    workspaceEntries: workspacePath ? shellData.workspaceEntries : [],
    workspacePath
  });
  emitShellSnapshot();
}

async function openFolderPath(directoryPath: string): Promise<void> {
  const workspaceEntries = await collectWorkspaceEntries(directoryPath);

  updateShellData({
    activeDocumentId: null,
    documents: [],
    status: `Opened workspace ${path.basename(directoryPath)}.`,
    workspaceEntries,
    workspacePath: directoryPath
  });
  emitShellSnapshot();
}

async function handleOpenTarget(targetPath: string): Promise<void> {
  try {
    const targetStats = await stat(targetPath);

    if (targetStats.isDirectory()) {
      await openFolderPath(targetPath);
      return;
    }

    if (targetStats.isFile() && isMarkdownFilePath(targetPath)) {
      await openFilePath(targetPath);
    }
  } catch (error) {
    emitToRenderer({
      type: "status",
      message:
        error instanceof Error
          ? error.message
          : `Failed to open "${targetPath}".`
    });
  }
}

async function flushPendingOpenTargets(): Promise<void> {
  if (!mainWindow || pendingOpenTargets.length === 0) {
    return;
  }

  const targets = pendingOpenTargets;
  pendingOpenTargets = [];

  for (const targetPath of targets) {
    await handleOpenTarget(targetPath);
  }
}

function queueOpenTargets(targets: string[]): void {
  pendingOpenTargets.push(...targets);
}

function normalizeOpenTargets(argumentsList: string[]): string[] {
  return argumentsList.filter((argument) => {
    if (!argument || argument.startsWith("-")) {
      return false;
    }

    if (argument === "." || argument === "..") {
      return false;
    }

    return path.isAbsolute(argument);
  });
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

      await openFilePath(selectedPath);
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

      await openFolderPath(selectedPath);
      return;
    }
    case "save":
      emitToRenderer({
        type: "status",
        message: "Save wiring lands after workspace and editor integration."
      });
      return;
    case "save-as":
      emitToRenderer({
        type: "status",
        message: "Save As wiring lands after workspace and editor integration."
      });
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
    icon: appIconPath,
    backgroundColor: "#f3ecdf",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
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
    updateShellData({
      status:
        "Desktop shell ready. Workspace loading and document sessions are available."
    });
    emitShellSnapshot();
    void flushPendingOpenTargets();
  });
}

ipcMain.handle("pluma:command", async (_event, command: CommandName) => {
  await handleCommand(command);
});

ipcMain.handle(
  "pluma:open-workspace-file",
  async (_event, filePath: string) => {
    await openFilePath(filePath, { workspacePath: shellData.workspacePath });
  }
);

app.whenReady().then(() => {
  setApplicationIcon();
  Menu.setApplicationMenu(buildMenu());
  createWindow();
  queueOpenTargets(normalizeOpenTargets(process.argv.slice(1)));
  void flushPendingOpenTargets();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  queueOpenTargets([filePath]);
  void flushPendingOpenTargets();
});

app.on("second-instance", (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  }

  queueOpenTargets(normalizeOpenTargets(argv));
  void flushPendingOpenTargets();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
