import {
  app,
  BrowserWindow,
  clipboard,
  Menu,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  type MenuItemConstructorOptions
} from "electron";
import { copyFile, cp, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import {
  formatMarkdownText,
  markDocumentSessionConflict,
  markDocumentSessionExternalChange,
  markDocumentSessionSaveError,
  markDocumentSessionSaved,
  markDocumentSessionSaving,
  serializeMarkdownSession,
  shouldProtectDocumentSessionClose,
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
import {
  confirmDiscardDocumentsSequentially as confirmDiscardDocumentsSequentiallyDialog,
  confirmDiscardProtectedDocuments as confirmDiscardProtectedDocumentsDialog
} from "./main/dialogs/documentProtection";
import { buildTabContextMenu } from "./main/menus/tabContextMenu";
import { buildWorkspaceContextMenu } from "./main/menus/workspaceContextMenu";
import {
  clearWorkspaceClipboard,
  getWorkspaceClipboard,
  hasWorkspaceClipboard,
  setWorkspaceClipboard,
  type WorkspaceItemKind
} from "./main/workspace/workspaceClipboard";
import {
  getDocumentsInWorkspacePath,
  getWorkspaceTargetDirectory
} from "./main/workspace/workspacePathHelpers";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let autosaveEnabled = true;
let currentMode: EditorViewMode = "source";
let isQuitting = false;
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

function getDefaultNewFilePath(): string {
  return path.join(
    shellData.workspacePath ?? app.getPath("documents"),
    "Untitled.md"
  );
}

function getDefaultSaveAsPath(document: DocumentSession): string {
  if (document.location.kind === "desktop-path") {
    const parsedPath = path.parse(document.location.path);

    return path.join(
      parsedPath.dir,
      `${parsedPath.name} copy${parsedPath.ext}`
    );
  }

  return getDefaultNewFilePath();
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

function closeDocumentSessions(documentIds: string[], status: string): void {
  const documentIdSet = new Set(documentIds);

  for (const documentId of documentIdSet) {
    autosaveScheduler.clear(documentId);
  }

  const nextDocuments = shellData.documents.filter(
    (document) => !documentIdSet.has(document.id)
  );
  const activeDocumentId = documentIdSet.has(shellData.activeDocumentId ?? "")
    ? (nextDocuments[0]?.id ?? null)
    : shellData.activeDocumentId;

  updateShellData({
    activeDocumentId,
    documents: nextDocuments,
    status
  });
  updateActiveFileWatcher();
}

function getDocumentById(documentId: string): DocumentSession | null {
  return (
    shellData.documents.find((document) => document.id === documentId) ?? null
  );
}

function getProtectedDocuments(): DocumentSession[] {
  return shellData.documents.filter(shouldProtectDocumentSessionClose);
}

async function closeActiveDocumentSession(): Promise<void> {
  const activeDocument = getActiveDocument();

  if (!activeDocument) {
    emitToRenderer({ type: "status", message: "No active document to close." });
    return;
  }

  if (
    shouldProtectDocumentSessionClose(activeDocument) &&
    !(await confirmDiscardProtectedDocuments([activeDocument], "close-tab"))
  ) {
    emitToRenderer({ type: "status", message: "Close tab cancelled." });
    emitShellSnapshot();
    return;
  }

  closeDocumentSession(activeDocument.id);
  persistSessionStateSoon();
  emitShellSnapshot();
}

async function closeDocumentsWithProtection(
  documents: DocumentSession[],
  status: string
): Promise<void> {
  if (documents.length === 0) {
    emitToRenderer({ type: "status", message: "No tabs to close." });
    return;
  }

  const protectedDocuments = documents.filter(
    shouldProtectDocumentSessionClose
  );

  if (!(await confirmDiscardDocumentsSequentially(protectedDocuments))) {
    emitToRenderer({ type: "status", message: "Close tab cancelled." });
    emitShellSnapshot();
    return;
  }

  closeDocumentSessions(
    documents.map((document) => document.id),
    status
  );
  persistSessionStateSoon();
  emitShellSnapshot();
}

async function confirmDiscardProtectedDocuments(
  documents: DocumentSession[],
  action: "close-tab" | "quit" | "reload"
): Promise<boolean> {
  return confirmDiscardProtectedDocumentsDialog(mainWindow, documents, action);
}

async function confirmDiscardDocumentsSequentially(
  documents: DocumentSession[]
): Promise<boolean> {
  return confirmDiscardDocumentsSequentiallyDialog(mainWindow, documents);
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

  if (activeDocument.rawText === activeDocument.lastSavedText) {
    const nextSession = await createSessionForFilePath(fileSystem, filePath);

    if (!nextSession) {
      updateShellData({
        documents: shellData.documents.map((document) =>
          document.id === activeDocument.id
            ? markDocumentSessionConflict(document)
            : document
        ),
        status: "Active file changed on disk but could not be reloaded."
      });
      emitShellSnapshot();
      return;
    }

    updateShellData({
      documents: shellData.documents.map((document) =>
        document.id === activeDocument.id ? nextSession : document
      ),
      status: "Active file reloaded from disk."
    });
    emitShellSnapshot();
    return;
  }

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

async function createNewMarkdownFile(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: getDefaultNewFilePath(),
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
    title: "New Markdown File"
  });

  if (result.canceled || !result.filePath) {
    emitToRenderer({ type: "status", message: "New file cancelled." });
    return;
  }

  const fileLocation = {
    kind: "desktop-path" as const,
    path: result.filePath
  };
  const writeResult = await fileSystem.writeTextAtomic(
    fileLocation,
    "# Untitled\n"
  );

  if (writeResult.kind !== "success") {
    emitToRenderer({
      type: "status",
      message:
        writeResult.kind === "conflict"
          ? `New file conflict: file was ${writeResult.reason}.`
          : `New file failed: ${writeResult.message}`
    });
    return;
  }

  await openFilePath(result.filePath);
  await refreshWorkspaceEntries();
}

async function saveActiveDocumentAs(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const activeDocument = getActiveDocument();

  if (!activeDocument) {
    emitToRenderer({ type: "status", message: "No active document to save." });
    return;
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: getDefaultSaveAsPath(activeDocument),
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
    title: "Save Markdown File As"
  });

  if (result.canceled || !result.filePath) {
    emitToRenderer({ type: "status", message: "Save As cancelled." });
    return;
  }

  const textToSave = activeDocument.rawText;
  const fileLocation = {
    kind: "desktop-path" as const,
    path: result.filePath
  };
  const saveResult = await fileSystem.writeTextAtomic(fileLocation, textToSave);

  if (saveResult.kind !== "success") {
    emitToRenderer({
      type: "status",
      message:
        saveResult.kind === "conflict"
          ? `Save As conflict: file was ${saveResult.reason}.`
          : `Save As failed: ${saveResult.message}`
    });
    return;
  }

  await openFilePath(result.filePath);
  await refreshWorkspaceEntries();
}

async function renameDocument(documentId: string): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const document = getDocumentById(documentId);

  if (!document || document.location.kind !== "desktop-path") {
    emitToRenderer({
      type: "status",
      message: "Only desktop files can be renamed."
    });
    return;
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    buttonLabel: "Rename",
    defaultPath: document.location.path,
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
    title: "Rename Markdown File"
  });

  if (result.canceled || !result.filePath) {
    emitToRenderer({ type: "status", message: "Rename cancelled." });
    return;
  }

  const targetPath = result.filePath;

  if (targetPath === document.location.path) {
    emitToRenderer({ type: "status", message: "Rename kept the same path." });
    return;
  }

  try {
    const existingTarget = await stat(targetPath).catch(() => null);

    if (existingTarget) {
      emitToRenderer({
        type: "status",
        message: "Rename cancelled: target file already exists."
      });
      return;
    }

    selfWritePaths.add(document.location.path);
    selfWritePaths.add(targetPath);
    await rename(document.location.path, targetPath);
  } catch (error) {
    emitToRenderer({
      type: "status",
      message:
        error instanceof Error
          ? `Rename failed: ${error.message}`
          : "Rename failed."
    });
    return;
  } finally {
    selfWritePaths.delete(document.location.path);
    selfWritePaths.delete(targetPath);
  }

  const nextSession = await createSessionForFilePath(fileSystem, targetPath);

  if (!nextSession) {
    emitToRenderer({
      type: "status",
      message: "Rename completed, but the renamed file could not be reopened."
    });
    closeDocumentSession(document.id);
    await refreshWorkspaceEntries();
    persistSessionStateSoon();
    emitShellSnapshot();
    return;
  }

  const renamedDocument: DocumentSession = {
    ...document,
    id: nextSession.id,
    lastSavedMetadata: nextSession.lastSavedMetadata,
    location: nextSession.location
  };

  autosaveScheduler.clear(document.id);
  if (autosaveEnabled && renamedDocument.saveState === "dirty") {
    autosaveScheduler.schedule(renamedDocument.id);
  }

  updateShellData({
    activeDocumentId:
      shellData.activeDocumentId === document.id
        ? renamedDocument.id
        : shellData.activeDocumentId,
    documents: shellData.documents.map((candidate) =>
      candidate.id === document.id ? renamedDocument : candidate
    ),
    status: `Renamed ${path.basename(document.location.path)} to ${path.basename(targetPath)}.`
  });
  updateActiveFileWatcher();
  await refreshWorkspaceEntries();
  persistSessionStateSoon();
  emitShellSnapshot();
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
        ? markDocumentSessionSaveError({
            ...document,
            rawText: textToSave
          })
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

  if (
    shouldProtectDocumentSessionClose(activeDocument) &&
    !(await confirmDiscardProtectedDocuments([activeDocument], "reload"))
  ) {
    emitToRenderer({ type: "status", message: "Reload cancelled." });
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
        ? `File path: ${activeDocument.location.path}`
        : "No desktop file path to show."
  });
}

function copyDocumentPath(documentId: string): void {
  const document = getDocumentById(documentId);

  if (!document || document.location.kind !== "desktop-path") {
    emitToRenderer({ type: "status", message: "No file path to copy." });
    return;
  }

  clipboard.writeText(document.location.path);
  emitToRenderer({ type: "status", message: "Copied file path." });
}

function showDocumentInFolder(documentId: string): void {
  const document = getDocumentById(documentId);

  if (!document || document.location.kind !== "desktop-path") {
    emitToRenderer({ type: "status", message: "No file to show in folder." });
    return;
  }

  shell.showItemInFolder(document.location.path);
  emitToRenderer({ type: "status", message: "Showing file in folder." });
}

function revealDocumentInWorkspace(document: DocumentSession): void {
  if (
    !shellData.workspacePath ||
    document.location.kind !== "desktop-path" ||
    !isPathInsideDirectory(shellData.workspacePath, document.location.path)
  ) {
    emitToRenderer({
      type: "status",
      message: "This file is not in the active workspace."
    });
    return;
  }

  updateShellData({
    activeDocumentId: document.id,
    status: `Revealed ${path.basename(document.location.path)} in workspace.`
  });
  updateActiveFileWatcher();
  persistSessionStateSoon();
  emitShellSnapshot();
  emitToRenderer({
    type: "reveal-workspace-file",
    path: document.location.path
  });
}

function showTabContextMenu(documentId: string): void {
  const document = getDocumentById(documentId);

  if (!document || !mainWindow) {
    return;
  }

  const otherDocuments = shellData.documents.filter(
    (candidate) => candidate.id !== document.id
  );
  const savedDocuments = shellData.documents.filter(
    (candidate) => candidate.saveState === "idle"
  );
  const hasDesktopPath = document.location.kind === "desktop-path";
  const canRevealInWorkspace =
    shellData.workspacePath !== null &&
    document.location.kind === "desktop-path" &&
    isPathInsideDirectory(shellData.workspacePath, document.location.path);
  const menu = buildTabContextMenu({
    canCloseAll: shellData.documents.length > 0,
    canCloseOthers: otherDocuments.length > 0,
    canCloseSavedTabs: savedDocuments.length > 0,
    canCopyPath: hasDesktopPath,
    canRename: hasDesktopPath,
    canRevealInWorkspace,
    canShowInFolder: hasDesktopPath,
    onClose: () =>
      void closeDocumentsWithProtection([document], "Closed document tab."),
    onCloseOthers: () =>
      void closeDocumentsWithProtection(
        otherDocuments,
        "Closed other document tabs."
      ),
    onCloseSavedTabs: () =>
      void closeDocumentsWithProtection(
        savedDocuments,
        "Closed saved document tabs."
      ),
    onCloseAll: () =>
      void closeDocumentsWithProtection(
        shellData.documents,
        "Closed all document tabs."
      ),
    onRename: () => void renameDocument(document.id),
    onCopyPath: () => copyDocumentPath(document.id),
    onShowInFolder: () => showDocumentInFolder(document.id),
    onRevealInWorkspace: () => revealDocumentInWorkspace(document)
  });

  menu.popup({ window: mainWindow });
}

async function createWorkspaceFile(
  targetPath: string,
  kind: WorkspaceItemKind
): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const targetDirectory = getWorkspaceTargetDirectory(targetPath, kind);
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(targetDirectory, "Untitled.md"),
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
    title: "New Markdown File"
  });

  if (result.canceled || !result.filePath) {
    emitToRenderer({ type: "status", message: "New file cancelled." });
    return;
  }

  const writeResult = await fileSystem.writeTextAtomic(
    { kind: "desktop-path", path: result.filePath },
    "# Untitled\n"
  );

  if (writeResult.kind !== "success") {
    emitToRenderer({
      type: "status",
      message:
        writeResult.kind === "conflict"
          ? `New file conflict: file was ${writeResult.reason}.`
          : `New file failed: ${writeResult.message}`
    });
    return;
  }

  await openFilePath(result.filePath, {
    workspacePath: shellData.workspacePath
  });
  await refreshWorkspaceEntries();
}

async function createWorkspaceDirectory(
  targetPath: string,
  kind: WorkspaceItemKind
): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const targetDirectory = getWorkspaceTargetDirectory(targetPath, kind);
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(targetDirectory, "New Folder"),
    title: "New Directory"
  });

  if (result.canceled || !result.filePath) {
    emitToRenderer({ type: "status", message: "New directory cancelled." });
    return;
  }

  try {
    await mkdir(result.filePath);
  } catch (error) {
    emitToRenderer({
      type: "status",
      message:
        error instanceof Error
          ? `New directory failed: ${error.message}`
          : "New directory failed."
    });
    return;
  }

  await refreshWorkspaceEntries();
  emitToRenderer({
    type: "status",
    message: `Created directory ${path.basename(result.filePath)}.`
  });
}

async function renameWorkspaceItem(
  targetPath: string,
  kind: WorkspaceItemKind
): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const openDocuments = getDocumentsInWorkspacePath(
    shellData.documents,
    targetPath,
    kind
  );
  const protectedDocuments = openDocuments.filter(
    shouldProtectDocumentSessionClose
  );

  if (
    protectedDocuments.length > 0 &&
    !(await confirmDiscardDocumentsSequentially(protectedDocuments))
  ) {
    emitToRenderer({ type: "status", message: "Rename cancelled." });
    emitShellSnapshot();
    return;
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    buttonLabel: "Rename",
    defaultPath: targetPath,
    title: kind === "folder" ? "Rename Directory" : "Rename File"
  });

  if (result.canceled || !result.filePath) {
    emitToRenderer({ type: "status", message: "Rename cancelled." });
    return;
  }

  if (result.filePath === targetPath) {
    emitToRenderer({ type: "status", message: "Rename kept the same path." });
    return;
  }

  try {
    const existingTarget = await stat(result.filePath).catch(() => null);

    if (existingTarget) {
      emitToRenderer({
        type: "status",
        message: "Rename cancelled: target already exists."
      });
      return;
    }

    selfWritePaths.add(targetPath);
    selfWritePaths.add(result.filePath);
    await rename(targetPath, result.filePath);
  } catch (error) {
    emitToRenderer({
      type: "status",
      message:
        error instanceof Error
          ? `Rename failed: ${error.message}`
          : "Rename failed."
    });
    return;
  } finally {
    selfWritePaths.delete(targetPath);
    selfWritePaths.delete(result.filePath);
  }

  if (openDocuments.length > 0) {
    closeDocumentSessions(
      openDocuments.map((document) => document.id),
      "Closed renamed document tabs."
    );
  }

  await refreshWorkspaceEntries();
  persistSessionStateSoon();
  emitShellSnapshot();
}

async function pasteWorkspaceItem(
  targetPath: string,
  kind: WorkspaceItemKind
): Promise<void> {
  const source = getWorkspaceClipboard();

  if (!source) {
    emitToRenderer({ type: "status", message: "Nothing to paste." });
    return;
  }

  const targetDirectory = getWorkspaceTargetDirectory(targetPath, kind);
  const destinationPath = path.join(
    targetDirectory,
    path.basename(source.path)
  );

  if (destinationPath === source.path) {
    emitToRenderer({
      type: "status",
      message: "Paste cancelled: source and destination are the same."
    });
    return;
  }

  try {
    const existingTarget = await stat(destinationPath).catch(() => null);

    if (existingTarget) {
      emitToRenderer({
        type: "status",
        message: "Paste cancelled: target already exists."
      });
      return;
    }

    if (source.operation === "copy") {
      if (source.kind === "folder") {
        await cp(source.path, destinationPath, { recursive: true });
      } else {
        await copyFile(source.path, destinationPath);
      }
    } else {
      const openDocuments = getDocumentsInWorkspacePath(
        shellData.documents,
        source.path,
        source.kind
      );
      const protectedDocuments = openDocuments.filter(
        shouldProtectDocumentSessionClose
      );

      if (
        protectedDocuments.length > 0 &&
        !(await confirmDiscardDocumentsSequentially(protectedDocuments))
      ) {
        emitToRenderer({ type: "status", message: "Paste cancelled." });
        emitShellSnapshot();
        return;
      }

      selfWritePaths.add(source.path);
      selfWritePaths.add(destinationPath);
      await rename(source.path, destinationPath);
      clearWorkspaceClipboard();

      if (openDocuments.length > 0) {
        closeDocumentSessions(
          openDocuments.map((document) => document.id),
          "Closed moved document tabs."
        );
      }
    }
  } catch (error) {
    emitToRenderer({
      type: "status",
      message:
        error instanceof Error
          ? `Paste failed: ${error.message}`
          : "Paste failed."
    });
    return;
  } finally {
    selfWritePaths.delete(source.path);
    selfWritePaths.delete(destinationPath);
  }

  await refreshWorkspaceEntries();
  persistSessionStateSoon();
  emitShellSnapshot();
}

async function moveWorkspaceItemToTrash(
  targetPath: string,
  kind: WorkspaceItemKind
): Promise<void> {
  const openDocuments = getDocumentsInWorkspacePath(
    shellData.documents,
    targetPath,
    kind
  );
  const protectedDocuments = openDocuments.filter(
    shouldProtectDocumentSessionClose
  );

  if (
    protectedDocuments.length > 0 &&
    !(await confirmDiscardDocumentsSequentially(protectedDocuments))
  ) {
    emitToRenderer({ type: "status", message: "Move to Trash cancelled." });
    emitShellSnapshot();
    return;
  }

  try {
    selfWritePaths.add(targetPath);
    await shell.trashItem(targetPath);
  } catch (error) {
    emitToRenderer({
      type: "status",
      message:
        error instanceof Error
          ? `Move to Trash failed: ${error.message}`
          : "Move to Trash failed."
    });
    return;
  } finally {
    selfWritePaths.delete(targetPath);
  }

  if (openDocuments.length > 0) {
    closeDocumentSessions(
      openDocuments.map((document) => document.id),
      "Closed trashed document tabs."
    );
  }

  await refreshWorkspaceEntries();
  persistSessionStateSoon();
  emitShellSnapshot();
}

function showWorkspaceContextMenu(
  targetPath: string,
  kind: WorkspaceItemKind
): void {
  if (!mainWindow) {
    return;
  }

  const menu = buildWorkspaceContextMenu({
    canPaste: hasWorkspaceClipboard(),
    onNewFile: () => void createWorkspaceFile(targetPath, kind),
    onNewDirectory: () => void createWorkspaceDirectory(targetPath, kind),
    onCopy: () => {
      setWorkspaceClipboard({ operation: "copy", path: targetPath, kind });
      emitToRenderer({ type: "status", message: "Copied workspace item." });
    },
    onCut: () => {
      setWorkspaceClipboard({ operation: "cut", path: targetPath, kind });
      emitToRenderer({ type: "status", message: "Cut workspace item." });
    },
    onPaste: () => void pasteWorkspaceItem(targetPath, kind),
    onRename: () => void renameWorkspaceItem(targetPath, kind),
    onMoveToTrash: () => void moveWorkspaceItemToTrash(targetPath, kind),
    onShowInFolder: () => {
      shell.showItemInFolder(targetPath);
      emitToRenderer({ type: "status", message: "Showing item in folder." });
    }
  });

  menu.popup({ window: mainWindow });
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

async function setAutosaveEnabled(enabled: boolean): Promise<void> {
  const currentSettings = await readAppSettings(getAppSettingsPath());
  const nextSettings: AppSettings = {
    ...currentSettings,
    autosaveEnabled: enabled
  };

  await writeAppSettings(getAppSettingsPath(), nextSettings);
  autosaveEnabled = enabled;

  if (!autosaveEnabled) {
    autosaveScheduler.clearAll();
  }

  Menu.setApplicationMenu(buildMenu());
  emitToRenderer({
    type: "status",
    message: autosaveEnabled ? "Auto Save enabled." : "Auto Save disabled."
  });
}

function getAppMenu(): MenuItemConstructorOptions[] {
  return process.platform === "darwin"
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        }
      ]
    : [];
}

async function handleCommand(command: CommandName): Promise<void> {
  if (!mainWindow) {
    return;
  }

  switch (command) {
    case "close-active-tab":
      await closeActiveDocumentSession();
      return;
    case "compare-conflict":
      showManualCompareStatus();
      return;
    case "keep-editing":
      await keepEditingActiveDocument();
      return;
    case "new-file":
      await createNewMarkdownFile();
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
      await saveActiveDocumentAs();
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
    ...getAppMenu(),
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: () => void handleCommand("new-file")
        },
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
        {
          checked: autosaveEnabled,
          click: (menuItem) => {
            void setAutosaveEnabled(menuItem.checked);
          },
          label: "Auto Save",
          type: "checkbox"
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => void handleCommand("close-active-tab")
        },
        ...(process.platform === "darwin"
          ? []
          : [
              {
                label: "Quit",
                role: "quit"
              } satisfies MenuItemConstructorOptions
            ])
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

  mainWindow.on("close", (event) => {
    if (isQuitting || getProtectedDocuments().length === 0) {
      return;
    }

    event.preventDefault();

    void confirmDiscardProtectedDocuments(getProtectedDocuments(), "quit").then(
      (canQuit) => {
        if (!canQuit) {
          emitToRenderer({ type: "status", message: "Quit cancelled." });
          return;
        }

        isQuitting = true;
        app.quit();
      }
    );
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

ipcMain.handle("pluma:close-tab", async (_event, tabId: string) => {
  const document = getDocumentById(tabId);

  if (
    document &&
    shouldProtectDocumentSessionClose(document) &&
    !(await confirmDiscardProtectedDocuments([document], "close-tab"))
  ) {
    emitToRenderer({ type: "status", message: "Close tab cancelled." });
    emitShellSnapshot();
    return;
  }

  closeDocumentSession(tabId);
  persistSessionStateSoon();
  emitShellSnapshot();
});

ipcMain.handle("pluma:show-tab-context-menu", (_event, tabId: string) => {
  showTabContextMenu(tabId);
});

ipcMain.handle(
  "pluma:show-workspace-context-menu",
  (_event, targetPath: unknown, kind: unknown) => {
    if (
      typeof targetPath !== "string" ||
      (kind !== "file" && kind !== "folder")
    ) {
      return;
    }

    showWorkspaceContextMenu(targetPath, kind);
  }
);

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
      if (autosaveEnabled) {
        autosaveScheduler.schedule(documentId);
      } else {
        autosaveScheduler.clear(documentId);
      }
    } else {
      autosaveScheduler.clear(documentId);
    }
    emitShellSnapshot();
  }
);

ipcMain.handle("pluma:get-settings", async () => {
  const settings = await readAppSettings(getAppSettingsPath());
  autosaveEnabled = settings.autosaveEnabled;

  return settings;
});

ipcMain.handle(
  "pluma:update-settings",
  async (_event, settings: Partial<AppSettings>) => {
    const currentSettings = await readAppSettings(getAppSettingsPath());
    const nextSettings: AppSettings = {
      ...currentSettings,
      ...(typeof settings.autosaveEnabled === "boolean"
        ? { autosaveEnabled: settings.autosaveEnabled }
        : {}),
      ...(isThemePreference(settings.themePreference)
        ? { themePreference: settings.themePreference }
        : {})
    };

    await writeAppSettings(getAppSettingsPath(), nextSettings);
    autosaveEnabled = nextSettings.autosaveEnabled;

    if (!autosaveEnabled) {
      autosaveScheduler.clearAll();
    }

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
  autosaveEnabled = (await readAppSettings(getAppSettingsPath()))
    .autosaveEnabled;
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

app.on("before-quit", (event) => {
  if (isQuitting || getProtectedDocuments().length === 0 || !mainWindow) {
    isQuitting = true;
    return;
  }

  event.preventDefault();

  void confirmDiscardProtectedDocuments(getProtectedDocuments(), "quit").then(
    (canQuit) => {
      if (!canQuit) {
        emitToRenderer({ type: "status", message: "Quit cancelled." });
        return;
      }

      isQuitting = true;
      app.quit();
    }
  );
});

app.on("window-all-closed", () => {
  autosaveScheduler.clearAll();
  activeFileWatcher.close();
  workspaceWatcher.close();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
