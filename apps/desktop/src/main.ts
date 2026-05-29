import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  nativeImage,
  type MenuItemConstructorOptions
} from "electron";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { createDocumentSession, type DesktopFileLocation } from "@pluma/core";
import { DesktopFileSystemAdapter } from "@pluma/core-desktop";
import installExtension, {
  REACT_DEVELOPER_TOOLS
} from "electron-devtools-installer";
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
const isDevelopment = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
let shellData: DesktopShellSnapshot = {
  activeDocumentId: null,
  documents: [],
  isDevelopment,
  paneSizes: [],
  status: "Starting desktop shell...",
  workspaceEntries: [],
  workspacePath: null
};
const markdownExtensions = new Set([".md", ".markdown", ".mdown"]);
const sessionStateFileName = "session-state.json";
const appSettingsFileName = "settings.json";

type PersistedSessionState = {
  activeDocumentPath: string | null;
  documentPaths: string[];
  editorMode: EditorMode;
  paneSizes?: number[];
  workspacePath: string | null;
};

type ThemePreference = "system" | "light" | "dark";

type AppSettings = {
  themePreference: ThemePreference;
};

const defaultAppSettings: AppSettings = {
  themePreference: "system"
};

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

function getSessionStatePath(): string {
  return path.join(app.getPath("userData"), sessionStateFileName);
}

function getAppSettingsPath(): string {
  return path.join(app.getPath("userData"), appSettingsFileName);
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppSettings>;

  return isThemePreference(candidate.themePreference);
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readAppSettings(): Promise<AppSettings> {
  const parsedSettings = await readJsonFile(getAppSettingsPath());

  if (!isAppSettings(parsedSettings)) {
    return defaultAppSettings;
  }

  return parsedSettings;
}

async function writeAppSettings(settings: AppSettings): Promise<void> {
  await writeJsonFile(getAppSettingsPath(), settings);
}

function getDocumentPath(documentId: string | null): string | null {
  const document = shellData.documents.find(
    (candidate) => candidate.id === documentId
  );

  if (document?.location.kind !== "desktop-path") {
    return null;
  }

  return document.location.path;
}

function getPersistedSessionState(): PersistedSessionState {
  return {
    activeDocumentPath: getDocumentPath(shellData.activeDocumentId),
    documentPaths: shellData.documents.flatMap((document) =>
      document.location.kind === "desktop-path" ? [document.location.path] : []
    ),
    editorMode: currentMode,
    paneSizes: shellData.paneSizes,
    workspacePath: shellData.workspacePath
  };
}

function isPersistedSessionState(
  value: unknown
): value is PersistedSessionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedSessionState>;

  return (
    (candidate.activeDocumentPath === null ||
      typeof candidate.activeDocumentPath === "string") &&
    Array.isArray(candidate.documentPaths) &&
    candidate.documentPaths.every(
      (documentPath) => typeof documentPath === "string"
    ) &&
    (candidate.editorMode === "rich" || candidate.editorMode === "source") &&
    (candidate.paneSizes === undefined ||
      (Array.isArray(candidate.paneSizes) &&
        candidate.paneSizes.every(
          (paneSize) => typeof paneSize === "number"
        ))) &&
    (candidate.workspacePath === null ||
      typeof candidate.workspacePath === "string")
  );
}

async function persistSessionState(): Promise<void> {
  if (!app.isReady()) {
    return;
  }

  const sessionStatePath = getSessionStatePath();

  await writeJsonFile(sessionStatePath, getPersistedSessionState());
}

function persistSessionStateSoon(): void {
  void persistSessionState().catch((error) => {
    emitToRenderer({
      type: "status",
      message:
        error instanceof Error
          ? `Failed to save session state: ${error.message}`
          : "Failed to save session state."
    });
  });
}

async function readPersistedSessionState(): Promise<PersistedSessionState | null> {
  const parsedState = await readJsonFile(getSessionStatePath());

  return isPersistedSessionState(parsedState) ? parsedState : null;
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

async function createSessionForFilePath(
  filePath: string
): Promise<ReturnType<typeof createDocumentSession> | null> {
  const fileLocation = toDesktopFileLocation(filePath);
  const metadata = await fileSystem.getMetadata(fileLocation);

  if (!metadata) {
    return null;
  }

  const rawText = await fileSystem.readText(fileLocation);

  return createDocumentSession({
    location: fileLocation,
    metadata,
    rawText
  });
}

async function tryCreateSessionForFilePath(
  filePath: string
): Promise<ReturnType<typeof createDocumentSession> | null> {
  try {
    return await createSessionForFilePath(filePath);
  } catch {
    return null;
  }
}

async function tryCollectWorkspaceEntries(
  directoryPath: string | null
): Promise<WorkspaceTreeEntry[]> {
  if (!directoryPath) {
    return [];
  }

  try {
    return await collectWorkspaceEntries(directoryPath);
  } catch {
    return [];
  }
}

function closeDocumentSession(documentId: string): void {
  const nextDocuments = shellData.documents.filter(
    (document) => document.id !== documentId
  );
  const activeDocumentId =
    shellData.activeDocumentId === documentId
      ? (nextDocuments[0]?.id ?? null)
      : shellData.activeDocumentId;

  updateShellData({
    activeDocumentId,
    documents: nextDocuments,
    status:
      nextDocuments.length === 0
        ? "All documents closed."
        : "Closed document tab."
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
  const session = await createSessionForFilePath(filePath);

  if (!session) {
    emitToRenderer({
      type: "status",
      message: `Could not read metadata for "${filePath}".`
    });
    return;
  }

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
  persistSessionStateSoon();
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
  persistSessionStateSoon();
  emitShellSnapshot();
}

async function restorePersistedSessionState(): Promise<void> {
  const persistedState = await readPersistedSessionState();

  if (!persistedState) {
    return;
  }

  currentMode = persistedState.editorMode;

  const workspaceEntries = await tryCollectWorkspaceEntries(
    persistedState.workspacePath
  );
  const documents = (
    await Promise.all(
      persistedState.documentPaths.map((documentPath) =>
        tryCreateSessionForFilePath(documentPath)
      )
    )
  ).filter((session) => session !== null);
  const activeDocument =
    documents.find(
      (document) =>
        document.location.kind === "desktop-path" &&
        document.location.path === persistedState.activeDocumentPath
    ) ?? documents[0];

  updateShellData({
    activeDocumentId: activeDocument?.id ?? null,
    documents,
    paneSizes: persistedState.paneSizes ?? [],
    status:
      documents.length > 0 || persistedState.workspacePath
        ? "Restored previous session."
        : "Desktop shell ready.",
    workspaceEntries,
    workspacePath: persistedState.workspacePath
  });
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
    case "open-devtools":
      if (!isDevelopment) {
        return;
      }

      mainWindow.webContents.openDevTools({ mode: "detach" });
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
        ...(isDevelopment
          ? [
              {
                label: "Open DevTools",
                accelerator:
                  process.platform === "darwin"
                    ? "Alt+Command+I"
                    : "Ctrl+Shift+I",
                click: () => void handleCommand("open-devtools")
              } satisfies MenuItemConstructorOptions
            ]
          : []),
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

ipcMain.handle("pluma:close-tab", (_event, tabId: string) => {
  closeDocumentSession(tabId);
  persistSessionStateSoon();
  emitShellSnapshot();
});

ipcMain.handle("pluma:update-pane-sizes", (_event, paneSizes: unknown) => {
  if (
    !Array.isArray(paneSizes) ||
    !paneSizes.every((paneSize) => typeof paneSize === "number")
  ) {
    return;
  }

  updateShellData({ paneSizes });
  persistSessionStateSoon();
});

ipcMain.handle("pluma:get-settings", async () => {
  return readAppSettings();
});

ipcMain.handle(
  "pluma:update-settings",
  async (_event, settings: Partial<AppSettings>) => {
    const currentSettings = await readAppSettings();
    const nextSettings: AppSettings = {
      ...currentSettings,
      ...(isThemePreference(settings.themePreference)
        ? { themePreference: settings.themePreference }
        : {})
    };

    await writeAppSettings(nextSettings);

    return nextSettings;
  }
);

async function installDevelopmentExtensions(): Promise<void> {
  if (!isDevelopment) {
    return;
  }

  try {
    await installExtension(REACT_DEVELOPER_TOOLS);
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `React DevTools installation failed: ${error.message}`
        : "React DevTools installation failed."
    );
  }
}

app.whenReady().then(async () => {
  setApplicationIcon();
  await installDevelopmentExtensions();
  Menu.setApplicationMenu(buildMenu());
  await restorePersistedSessionState();
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
