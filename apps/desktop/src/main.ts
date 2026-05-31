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

import {
  formatMarkdownText,
  markDocumentSessionConflict,
  markDocumentSessionExternalChange,
  markDocumentSessionSaved,
  markDocumentSessionSaving,
  serializeMarkdownSession,
  updateDocumentSessionText,
  type DocumentCapability,
  type DocumentSession,
  type FileMetadata
} from "@pluma/core";
import { DesktopFileSystemAdapter } from "@pluma/core-desktop";
import installExtension, {
  REACT_DEVELOPER_TOOLS
} from "electron-devtools-installer";
import started from "electron-squirrel-startup";
import type {
  CommandName,
  DesktopShellSnapshot,
  EditorViewMode,
  RendererEvent
} from "./shared/shellState";
import {
  isEditorViewMode,
  isThemePreference,
  readAppSettings,
  readPersistedSessionState,
  writeAppSettings,
  writePersistedSessionState,
  type AppSettings,
  type PersistedSessionState
} from "./main/persistence/appPersistence";
import { AutosaveScheduler } from "./main/autosave/autosaveScheduler";
import { ActiveFileWatcher } from "./main/watching/activeFileWatcher";
import {
  collectWorkspaceEntries,
  createSessionForFilePath,
  isMarkdownFilePath,
  isPathInsideDirectory,
  tryCollectWorkspaceEntries,
  tryCreateSessionForFilePath
} from "./main/workspace/desktopWorkspace";
import { WorkspaceWatcher } from "./main/watching/workspaceWatcher";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let currentMode: EditorViewMode = "source";
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
const sessionStateFileName = "session-state.json";
const appSettingsFileName = "settings.json";
const autosaveDelayMs = 900;

const autosaveScheduler = new AutosaveScheduler(
  autosaveDelayMs,
  (documentId) => {
    void saveDocument(documentId, "autosave");
  }
);
const selfWritePaths = new Set<string>();
const activeFileWatcher = new ActiveFileWatcher(
  (filePath) => {
    void handleActiveFileExternalChange(filePath);
  },
  (message) => emitToRenderer({ type: "status", message })
);
const workspaceWatcher = new WorkspaceWatcher(
  () => {
    void refreshWorkspaceEntries();
  },
  (message) => emitToRenderer({ type: "status", message })
);

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

function getActiveDocumentCapability(): DocumentCapability | null {
  const activeDocument = shellData.documents.find(
    (document) => document.id === shellData.activeDocumentId
  );

  return activeDocument?.capability ?? null;
}

function getActiveDocument(): DocumentSession | null {
  return (
    shellData.documents.find(
      (document) => document.id === shellData.activeDocumentId
    ) ?? null
  );
}

function getAllowedEditorMode(mode: EditorViewMode): EditorViewMode {
  return mode !== "source" && getActiveDocumentCapability() === "source-only"
    ? "source"
    : mode;
}

function getNextEditorMode(): EditorViewMode {
  return getAllowedEditorMode(currentMode === "rich" ? "source" : "rich");
}

async function persistSessionState(): Promise<void> {
  if (!app.isReady()) {
    return;
  }

  const sessionStatePath = getSessionStatePath();

  await writePersistedSessionState(
    sessionStatePath,
    getPersistedSessionState()
  );
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

function mergeDocumentSession(nextSession: DocumentSession): void {
  const remainingDocuments = shellData.documents.filter(
    (document) => document.id !== nextSession.id
  );

  updateShellData({
    activeDocumentId: nextSession.id,
    documents: [nextSession, ...remainingDocuments]
  });
  updateActiveFileWatcher();
}

function closeDocumentSession(documentId: string): void {
  autosaveScheduler.clear(documentId);
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
  updateActiveFileWatcher();
}

function updateActiveFileWatcher(): void {
  const activeDocument = getActiveDocument();
  const activePath =
    activeDocument?.location.kind === "desktop-path"
      ? activeDocument.location.path
      : null;

  activeFileWatcher.update(activePath);
}

function updateWorkspaceWatcher(): void {
  workspaceWatcher.update(shellData.workspacePath);
}

async function refreshWorkspaceEntries(): Promise<void> {
  if (!shellData.workspacePath) {
    return;
  }

  const workspaceEntries = await tryCollectWorkspaceEntries(
    fileSystem,
    shellData.workspacePath
  );

  updateShellData({
    workspaceEntries,
    status: "Workspace file tree updated."
  });
  emitShellSnapshot();
}

async function handleActiveFileExternalChange(filePath: string): Promise<void> {
  if (selfWritePaths.has(filePath)) {
    return;
  }

  const activeDocument = getActiveDocument();

  if (
    !activeDocument ||
    activeDocument.location.kind !== "desktop-path" ||
    activeDocument.location.path !== filePath
  ) {
    return;
  }

  const currentMetadata = await fileSystem.getMetadata(activeDocument.location);

  if (!currentMetadata) {
    updateShellData({
      documents: shellData.documents.map((document) =>
        document.id === activeDocument.id
          ? markDocumentSessionConflict(document)
          : document
      ),
      status: "Active file was deleted on disk."
    });
    emitShellSnapshot();
    return;
  }

  if (
    activeDocument.lastSavedMetadata &&
    currentMetadata.mtimeMs === activeDocument.lastSavedMetadata.mtimeMs &&
    currentMetadata.size === activeDocument.lastSavedMetadata.size &&
    currentMetadata.fileId === activeDocument.lastSavedMetadata.fileId
  ) {
    return;
  }

  autosaveScheduler.clear(activeDocument.id);
  updateShellData({
    documents: shellData.documents.map((document) =>
      document.id === activeDocument.id
        ? markDocumentSessionExternalChange(document)
        : document
    ),
    status: "Active file changed on disk."
  });
  emitShellSnapshot();
}

async function openFilePath(
  filePath: string,
  options: {
    workspacePath?: string | null;
  } = {}
): Promise<void> {
  const session = await createSessionForFilePath(fileSystem, filePath);

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
  currentMode = getAllowedEditorMode(currentMode);
  updateShellData({
    status: `Opened ${path.basename(filePath)}.`,
    workspaceEntries: workspacePath ? shellData.workspaceEntries : [],
    workspacePath
  });
  updateWorkspaceWatcher();
  emitToRenderer({ type: "mode-changed", mode: currentMode });
  persistSessionStateSoon();
  emitShellSnapshot();
}

async function openFolderPath(directoryPath: string): Promise<void> {
  const workspaceEntries = await collectWorkspaceEntries(
    fileSystem,
    directoryPath
  );

  updateShellData({
    activeDocumentId: null,
    documents: [],
    status: `Opened workspace ${path.basename(directoryPath)}.`,
    workspaceEntries,
    workspacePath: directoryPath
  });
  autosaveScheduler.clearAll();
  updateActiveFileWatcher();
  updateWorkspaceWatcher();
  persistSessionStateSoon();
  emitShellSnapshot();
}

async function saveActiveDocument(): Promise<void> {
  const activeDocument = getActiveDocument();

  if (!activeDocument) {
    emitToRenderer({ type: "status", message: "No active document to save." });
    return;
  }

  await saveDocument(activeDocument.id, "manual");
}

async function saveDocument(
  documentId: string,
  trigger: "autosave" | "manual"
): Promise<void> {
  const activeDocument = shellData.documents.find(
    (document) => document.id === documentId
  );

  if (!activeDocument || activeDocument.saveState === "idle") {
    return;
  }

  if (
    activeDocument.saveState === "conflict" ||
    activeDocument.saveState === "external-change"
  ) {
    emitToRenderer({
      type: "status",
      message: "Resolve the disk conflict before saving."
    });
    return;
  }

  if (activeDocument.location.kind !== "desktop-path") {
    emitToRenderer({
      type: "status",
      message: "Save is only available for desktop files."
    });
    return;
  }

  autosaveScheduler.clear(activeDocument.id);

  const shouldFormatRichSave = trigger === "manual" && currentMode === "rich";
  const textToSave = shouldFormatRichSave
    ? (await formatMarkdownText(activeDocument.rawText)).markdown
    : activeDocument.rawText;

  if (shouldFormatRichSave) {
    const serialized = serializeMarkdownSession({
      ...activeDocument,
      rawText: textToSave
    });

    if (serialized.fidelityWarnings.length > 0) {
      const fidelityWarning =
        serialized.fidelityWarnings[0] ??
        "Rich-mode save was blocked to avoid losing Markdown fidelity.";

      updateShellData({
        documents: shellData.documents.map((document) =>
          document.id === activeDocument.id
            ? { ...document, capability: "source-only", mode: "source" }
            : document
        ),
        status: fidelityWarning
      });
      currentMode = "source";
      emitToRenderer({ type: "mode-changed", mode: currentMode });
      emitShellSnapshot();
      return;
    }
  }

  updateShellData({
    documents: shellData.documents.map((document) =>
      document.id === activeDocument.id
        ? markDocumentSessionSaving(document)
        : document
    ),
    status:
      trigger === "autosave"
        ? `Autosaving ${path.basename(activeDocument.location.path)}.`
        : `Saving ${path.basename(activeDocument.location.path)}.`
  });
  emitShellSnapshot();

  const activeDocumentPath = activeDocument.location.path;

  selfWritePaths.add(activeDocumentPath);
  const saveResult = await fileSystem.writeTextAtomic(
    activeDocument.location,
    textToSave,
    {
      expectedMetadata: activeDocument.lastSavedMetadata
    }
  );
  setTimeout(() => {
    selfWritePaths.delete(activeDocumentPath);
  }, 150);

  if (saveResult.kind === "success") {
    updateShellData({
      documents: shellData.documents.map((document) =>
        document.id === activeDocument.id
          ? markDocumentAfterSuccessfulWrite(
              document,
              textToSave,
              saveResult.metadata,
              activeDocument.rawText
            )
          : document
      ),
      status:
        trigger === "autosave"
          ? `Autosaved ${path.basename(activeDocument.location.path)}.`
          : `Saved ${path.basename(activeDocument.location.path)}.`
    });
    persistSessionStateSoon();
    emitShellSnapshot();
    return;
  }

  if (saveResult.kind === "conflict") {
    updateShellData({
      documents: shellData.documents.map((document) =>
        document.id === activeDocument.id
          ? markDocumentSessionConflict(document)
          : document
      ),
      status: `Save conflict: file was ${saveResult.reason}.`
    });
    emitShellSnapshot();
    return;
  }

  updateShellData({
    documents: shellData.documents.map((document) =>
      document.id === activeDocument.id
        ? updateDocumentSessionText(document, textToSave)
        : document
    ),
    status: `Save failed: ${saveResult.message}`
  });
  emitShellSnapshot();
}

async function reloadActiveDocumentFromDisk(): Promise<void> {
  const activeDocument = getActiveDocument();

  if (!activeDocument || activeDocument.location.kind !== "desktop-path") {
    emitToRenderer({ type: "status", message: "No desktop file to reload." });
    return;
  }

  const nextSession = await createSessionForFilePath(
    fileSystem,
    activeDocument.location.path
  );

  if (!nextSession) {
    emitToRenderer({
      type: "status",
      message: "Could not reload file from disk."
    });
    return;
  }

  updateShellData({
    documents: shellData.documents.map((document) =>
      document.id === activeDocument.id ? nextSession : document
    ),
    status: `Reloaded ${path.basename(activeDocument.location.path)} from disk.`
  });
  emitShellSnapshot();
}

async function keepEditingActiveDocument(): Promise<void> {
  const activeDocument = getActiveDocument();

  if (!activeDocument) {
    return;
  }

  const metadata =
    activeDocument.location.kind === "desktop-path"
      ? await fileSystem.getMetadata(activeDocument.location)
      : activeDocument.lastSavedMetadata;

  updateShellData({
    documents: shellData.documents.map((document) =>
      document.id === activeDocument.id
        ? {
            ...document,
            lastSavedMetadata: metadata,
            saveState: "dirty"
          }
        : document
    ),
    status: "Kept in-memory edits. The next save will write over disk."
  });
  emitShellSnapshot();
}

function showManualCompareStatus(): void {
  const activeDocument = getActiveDocument();

  emitToRenderer({
    type: "status",
    message:
      activeDocument?.location.kind === "desktop-path"
        ? `Compare manually: ${activeDocument.location.path}`
        : "No desktop file to compare."
  });
}

function markDocumentAfterSuccessfulWrite(
  document: DocumentSession,
  savedText: string,
  metadata: FileMetadata,
  originalText: string
): DocumentSession {
  if (document.rawText === originalText || document.rawText === savedText) {
    return markDocumentSessionSaved(
      {
        ...document,
        rawText: savedText
      },
      metadata
    );
  }

  return {
    ...document,
    lastSavedMetadata: metadata,
    lastSavedText: savedText,
    saveState: document.rawText === savedText ? "idle" : "dirty"
  };
}

async function restorePersistedSessionState(): Promise<void> {
  const persistedState = await readPersistedSessionState(getSessionStatePath());

  if (!persistedState) {
    return;
  }

  currentMode = persistedState.editorMode;

  const workspaceEntries = await tryCollectWorkspaceEntries(
    fileSystem,
    persistedState.workspacePath
  );
  const documents = (
    await Promise.all(
      persistedState.documentPaths.map((documentPath) =>
        tryCreateSessionForFilePath(fileSystem, documentPath)
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
  updateActiveFileWatcher();
  updateWorkspaceWatcher();
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
    case "compare-conflict":
      showManualCompareStatus();
      return;
    case "keep-editing":
      await keepEditingActiveDocument();
      return;
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
    case "reload-from-disk":
      await reloadActiveDocumentFromDisk();
      return;
    case "save":
      await saveActiveDocument();
      return;
    case "save-as":
      emitToRenderer({
        type: "status",
        message: "Save As wiring lands after workspace and editor integration."
      });
      return;
    case "toggle-mode":
      currentMode = getNextEditorMode();
      emitToRenderer({ type: "mode-changed", mode: currentMode });
      persistSessionStateSoon();
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

ipcMain.handle("pluma:set-editor-mode", (_event, mode: unknown) => {
  if (!isEditorViewMode(mode)) {
    return;
  }

  currentMode = getAllowedEditorMode(mode);
  emitToRenderer({ type: "mode-changed", mode: currentMode });
  persistSessionStateSoon();
});

ipcMain.handle("pluma:set-active-document", (_event, documentId: unknown) => {
  if (
    typeof documentId !== "string" ||
    !shellData.documents.some((document) => document.id === documentId)
  ) {
    return;
  }

  updateShellData({
    activeDocumentId: documentId
  });
  updateActiveFileWatcher();
  persistSessionStateSoon();
  emitShellSnapshot();
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

ipcMain.handle(
  "pluma:update-document-text",
  (_event, documentId: unknown, rawText: unknown) => {
    if (typeof documentId !== "string" || typeof rawText !== "string") {
      return;
    }

    const nextDocuments = shellData.documents.map((document) =>
      document.id === documentId
        ? updateDocumentSessionText(document, rawText)
        : document
    );

    updateShellData({
      documents: nextDocuments,
      status: "Document edited."
    });
    const nextDocument = nextDocuments.find(
      (document) => document.id === documentId
    );
    if (nextDocument?.saveState === "dirty") {
      autosaveScheduler.schedule(documentId);
    } else {
      autosaveScheduler.clear(documentId);
    }
    emitShellSnapshot();
  }
);

ipcMain.handle("pluma:get-settings", async () => {
  return readAppSettings(getAppSettingsPath());
});

ipcMain.handle(
  "pluma:update-settings",
  async (_event, settings: Partial<AppSettings>) => {
    const currentSettings = await readAppSettings(getAppSettingsPath());
    const nextSettings: AppSettings = {
      ...currentSettings,
      ...(isThemePreference(settings.themePreference)
        ? { themePreference: settings.themePreference }
        : {})
    };

    await writeAppSettings(getAppSettingsPath(), nextSettings);

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
  autosaveScheduler.clearAll();
  activeFileWatcher.close();
  workspaceWatcher.close();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
