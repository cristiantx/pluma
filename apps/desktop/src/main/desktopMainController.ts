import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from "electron";
import path from "node:path";

import { DesktopFileSystemAdapter } from "@pluma/core-desktop";
import {
  defaultAppSettings,
  type AppSettings,
  type DefaultLineEnding
} from "@pluma/ui/settings";
import { downloadChromeExtension } from "electron-devtools-installer/dist/downloadChromeExtension.js";
import started from "electron-squirrel-startup";

import type { CommandName } from "../shared/shellState";
import {
  readAppSettings,
  readPersistedSessionState,
  writeAppSettings
} from "./persistence/appPersistence";
import { createAppDraftStorage } from "./persistence/appDraftStorage";
import {
  registerLocalAssetProtocolHandler,
  registerLocalAssetProtocolScheme
} from "./assets/localAssetProtocol";
import { buildApplicationMenu } from "./menus/applicationMenu";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { DocumentTextFlushCoordinator } from "./ipc/documentTextFlushCoordinator";
import { getAppSettingsUpdate } from "./settings/appSettingsUpdate";
import {
  shouldPersistAfterWindowClosed,
  shouldRouteWindowCloseThroughAppQuit
} from "./session/quitPersistence";
import {
  SessionStatePersistence,
  writeDesktopSessionState
} from "./session/sessionStatePersistence";
import { createMainWindow } from "./windows/createMainWindow";
import {
  DesktopWindowSession,
  type DesktopWindowSessionDependencies
} from "./windows/DesktopWindowSession";

export type DesktopMainProcessOptions = {
  mainBundleDirectory: string;
  rendererDevServerUrl: string | undefined;
  rendererName: string;
};

let mainBundleDirectory = "";
let rendererDevServerUrl: string | undefined;
let rendererName = "";
let autosaveEnabled = true;
let defaultLineEnding: DefaultLineEnding = "system";
let openExportedFile = false;
let restorePreviousSession = true;
let spellcheckEnabled = true;
let workspaceRespectGitIgnore = false;
let workspaceShowHiddenFiles = true;
let isDevelopment = false;
let isQuitting = false;
let latestFocusedWindowId: number | null = null;
let pendingOpenTargets: string[] = [];
let appSettingsSnapshot: AppSettings = { ...defaultAppSettings };
let settingsMutationQueue: Promise<void> = Promise.resolve();

const fileSystem = new DesktopFileSystemAdapter();
const sessions = new Map<number, DesktopWindowSession>();
const documentTextFlushCoordinator = new DocumentTextFlushCoordinator();
const windowsAllowedToClose = new Set<number>();
const sessionStateFileName = "session-state.json";
const appSettingsFileName = "settings.json";
const autosaveDelayMs = 900;
const draftsDirectoryName = "drafts";
const reactDeveloperToolsExtensionId = "fmkadmapgofadopljbjfkapdkoienihi";
const sessionStatePersistence = new SessionStatePersistence(async () => {
  if (!app.isReady()) {
    return;
  }

  await writeDesktopSessionState(
    getSessionStatePath(),
    getOrderedSessions(),
    getLatestFocusedSession()
  );
});

if (started) {
  app.quit();
}

registerLocalAssetProtocolScheme();

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function getAppIconPath(): string {
  return path.resolve(mainBundleDirectory, "../../assets/icon.png");
}

function setApplicationIcon(): void {
  const icon = nativeImage.createFromPath(getAppIconPath());

  if (icon.isEmpty()) {
    return;
  }

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }
}

function getSessionStatePath(): string {
  return path.join(app.getPath("userData"), sessionStateFileName);
}

function getAppSettingsPath(): string {
  return path.join(app.getPath("userData"), appSettingsFileName);
}

function getDraftsDirectory(): string {
  return path.join(app.getPath("userData"), draftsDirectoryName);
}

function persistSessionStateSoon(): void {
  void sessionStatePersistence.request().catch((error) => {
    getLatestFocusedSession()?.emitStatus(
      error instanceof Error
        ? `Failed to save session state: ${error.message}`
        : "Failed to save session state."
    );
  });
}

function getOrderedSessions(): DesktopWindowSession[] {
  return [...sessions.values()].filter(
    (session) => !session.window.isDestroyed()
  );
}

function getAuthorizedLocalAssetRoots(): string[] {
  return [
    ...new Set(
      getOrderedSessions().flatMap((session) =>
        session.getAuthorizedAssetRoots()
      )
    )
  ];
}

function getLatestFocusedSession(): DesktopWindowSession | null {
  if (latestFocusedWindowId !== null) {
    const latestSession = sessions.get(latestFocusedWindowId);

    if (latestSession && !latestSession.window.isDestroyed()) {
      return latestSession;
    }
  }

  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    return sessions.get(focusedWindow.id) ?? null;
  }

  return getOrderedSessions().at(-1) ?? null;
}

function getSessionForEvent(
  event: IpcMainEvent | IpcMainInvokeEvent
): DesktopWindowSession | null {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);

  return senderWindow ? (sessions.get(senderWindow.id) ?? null) : null;
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

async function flushPendingOpenTargets(): Promise<void> {
  if (pendingOpenTargets.length === 0) {
    return;
  }

  const session = getLatestFocusedSession() ?? createWindow();
  const targets = pendingOpenTargets;
  pendingOpenTargets = [];

  for (const targetPath of targets) {
    await session.handleOpenTarget(targetPath);
  }
}

async function setAutosaveEnabled(enabled: boolean): Promise<void> {
  const nextSettings = await updateStoredAppSettings({
    autosaveEnabled: enabled
  });
  getLatestFocusedSession()?.emitStatus(
    nextSettings.autosaveEnabled ? "Auto Save enabled." : "Auto Save disabled."
  );
}

function applySpellcheckEnabled(enabled: boolean): void {
  for (const session of sessions.values()) {
    if (!session.window.isDestroyed()) {
      session.window.webContents.session.setSpellCheckerEnabled(enabled);
    }
  }
}

function emitSettingsChanged(settings: AppSettings): void {
  for (const session of sessions.values()) {
    session.emitSettingsChanged(settings);
  }
}

async function setSpellcheckEnabled(enabled: boolean): Promise<void> {
  const nextSettings = await updateStoredAppSettings({
    spellcheckEnabled: enabled
  });
  getLatestFocusedSession()?.emitStatus(
    nextSettings.spellcheckEnabled
      ? "Spellcheck enabled."
      : "Spellcheck disabled."
  );
}

async function updateStoredAppSettings(
  update: Partial<AppSettings>
): Promise<AppSettings> {
  return enqueueSettingsMutation(async () => {
    const currentSettings = appSettingsSnapshot;
    const nextSettings: AppSettings = {
      ...currentSettings,
      ...update
    };

    await writeAppSettings(getAppSettingsPath(), nextSettings);
    applyAppSettingsSnapshot(nextSettings);

    if (!autosaveEnabled) {
      for (const session of sessions.values()) {
        session.clearAutosaveTimers();
      }
    }

    if (currentSettings.spellcheckEnabled !== nextSettings.spellcheckEnabled) {
      applySpellcheckEnabled(spellcheckEnabled);
    }

    if (
      currentSettings.workspaceShowHiddenFiles !==
        nextSettings.workspaceShowHiddenFiles ||
      currentSettings.workspaceRespectGitIgnore !==
        nextSettings.workspaceRespectGitIgnore
    ) {
      for (const session of sessions.values()) {
        void session.refreshSettingsSensitiveState().catch((error) => {
          session.emitStatus(
            error instanceof Error
              ? `Failed to refresh workspace settings: ${error.message}`
              : "Failed to refresh workspace settings."
          );
        });
      }
    }

    emitSettingsChanged(nextSettings);
    Menu.setApplicationMenu(getApplicationMenu());

    return nextSettings;
  });
}

function applyAppSettingsSnapshot(nextSettings: AppSettings): void {
  appSettingsSnapshot = nextSettings;
  autosaveEnabled = nextSettings.autosaveEnabled;
  defaultLineEnding = nextSettings.defaultLineEnding;
  openExportedFile = nextSettings.openExportedFile;
  restorePreviousSession = nextSettings.restorePreviousSession;
  spellcheckEnabled = nextSettings.spellcheckEnabled;
  workspaceRespectGitIgnore = nextSettings.workspaceRespectGitIgnore;
  workspaceShowHiddenFiles = nextSettings.workspaceShowHiddenFiles;
}

function enqueueSettingsMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = settingsMutationQueue.then(operation, operation);
  settingsMutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function resetStoredAppSettings(): Promise<AppSettings> {
  return updateStoredAppSettings(defaultAppSettings);
}

async function handleMenuCommand(command: CommandName): Promise<void> {
  if (command === "new-window") {
    createWindow();
    return;
  }

  const session = getLatestFocusedSession() ?? createWindow();

  if (!(await flushSessionDocumentText(session))) {
    return;
  }

  if (command === "reload-window") {
    session.window.webContents.reload();
    return;
  }

  if (command === "force-reload-window") {
    session.window.webContents.reloadIgnoringCache();
    return;
  }

  await session.handleCommand(command);
}

async function handleConvertLineEndings(target: "crlf" | "lf"): Promise<void> {
  const session = getLatestFocusedSession();

  if (!session || !(await flushSessionDocumentText(session))) {
    return;
  }

  session.convertActiveDocumentLineEndings(target);
}

async function flushSessionDocumentText(
  session: DesktopWindowSession
): Promise<boolean> {
  const flushed = await documentTextFlushCoordinator.request(
    session.window.webContents
  );

  if (!flushed) {
    session.emitStatus(
      "Could not synchronize the latest document edits. Try the action again."
    );
  }

  return flushed;
}

function getApplicationMenu(): Menu {
  const latestSession = getLatestFocusedSession();

  return buildApplicationMenu({
    autosaveEnabled,
    commandAvailability: {
      hasActiveDocument: latestSession?.hasActiveDocument() ?? false
    },
    isDevelopment,
    spellcheckEnabled,
    onCommand: (command) => void handleMenuCommand(command),
    onConvertLineEndings: (target) => void handleConvertLineEndings(target),
    onSetAutosaveEnabled: (enabled) => void setAutosaveEnabled(enabled),
    onSetSpellcheckEnabled: (enabled) => void setSpellcheckEnabled(enabled)
  });
}

function refreshApplicationMenu(): void {
  if (app.isReady()) {
    Menu.setApplicationMenu(getApplicationMenu());
  }
}

function createWindowDependencies(
  window: BrowserWindow
): DesktopWindowSessionDependencies {
  return {
    appDocumentsPath: app.getPath("documents"),
    draftStorage: createAppDraftStorage(getDraftsDirectory()),
    autosaveDelayMs,
    fileSystem,
    getAutosaveEnabled: () => autosaveEnabled,
    getDefaultLineEnding: () => defaultLineEnding,
    getOpenExportedFile: () => openExportedFile,
    getWorkspaceRespectGitIgnore: () => workspaceRespectGitIgnore,
    getWorkspaceShowHiddenFiles: () => workspaceShowHiddenFiles,
    isDevelopment,
    onMenuStateChange: refreshApplicationMenu,
    onPersistSessionState: persistSessionStateSoon,
    window
  };
}

function createWindow(): DesktopWindowSession {
  const window = createMainWindow({
    appIconPath: getAppIconPath(),
    mainBundleDirectory,
    rendererDevServerUrl,
    rendererName,
    spellcheckEnabled,
    onClosed: () => {
      const session = sessions.get(window.id);
      session?.dispose();
      documentTextFlushCoordinator.cancelSender(window.webContents.id);
      sessions.delete(window.id);
      windowsAllowedToClose.delete(window.id);

      if (latestFocusedWindowId === window.id) {
        latestFocusedWindowId = getOrderedSessions().at(-1)?.window.id ?? null;
      }

      refreshApplicationMenu();
      if (shouldPersistAfterWindowClosed(isQuitting)) {
        persistSessionStateSoon();
      }
    },
    onClose: (event) => {
      if (isQuitting || windowsAllowedToClose.has(window.id)) {
        return;
      }

      if (
        shouldRouteWindowCloseThroughAppQuit({
          isQuitting,
          isWindowAllowedToClose: windowsAllowedToClose.has(window.id),
          openWindowCount: getOrderedSessions().length,
          platform: process.platform
        })
      ) {
        event.preventDefault();
        void quitApplicationWithSessionPersistence();
        return;
      }

      event.preventDefault();
      void closeWindowAfterFlush(window.id);
    },
    onLoaded: () => {
      const session = sessions.get(window.id);
      session?.emitInitialState();
      void flushPendingOpenTargets();
    }
  });
  const session = new DesktopWindowSession(createWindowDependencies(window));

  sessions.set(window.id, session);
  latestFocusedWindowId = window.id;
  window.on("focus", () => {
    latestFocusedWindowId = window.id;
    refreshApplicationMenu();
  });

  return session;
}

async function closeWindowAfterFlush(windowId: number): Promise<void> {
  const session = sessions.get(windowId);

  if (!session || session.window.isDestroyed()) {
    return;
  }

  if (!(await flushSessionDocumentText(session))) {
    return;
  }

  if (
    session.getProtectedDocuments().length > 0 &&
    !(await session.closeWindowWithProtection())
  ) {
    return;
  }

  windowsAllowedToClose.add(windowId);
  session.window.close();
}

async function restorePersistedSessionState(): Promise<void> {
  if (!restorePreviousSession) {
    createWindow();
    return;
  }

  const persistedState = await readPersistedSessionState(getSessionStatePath());

  if (!persistedState || persistedState.windows.length === 0) {
    createWindow();
    return;
  }

  const restoredSessions: DesktopWindowSession[] = [];

  for (const windowState of persistedState.windows) {
    const session = createWindow();
    await session.restorePersistedState(windowState);
    restoredSessions.push(session);
  }

  const activeSession =
    restoredSessions[persistedState.activeWindowIndex] ?? restoredSessions[0];
  activeSession?.window.focus();
}

async function confirmQuitAcrossWindows(): Promise<boolean> {
  for (const session of getOrderedSessions()) {
    if (!(await session.closeWindowWithProtection())) {
      return false;
    }
  }

  return true;
}

async function quitApplicationWithSessionPersistence(): Promise<void> {
  const flushResults = await Promise.all(
    getOrderedSessions().map(flushSessionDocumentText)
  );

  if (flushResults.some((flushed) => !flushed)) {
    return;
  }

  if (!(await confirmQuitAcrossWindows())) {
    return;
  }

  isQuitting = true;
  await sessionStatePersistence.request();
  app.quit();
}

function registerDesktopIpcHandlers(): void {
  registerIpcHandlers({
    acknowledgeDocumentTextFlush: (event, requestId) => {
      documentTextFlushCoordinator.acknowledge(event.sender.id, requestId);
    },
    runCommand: async (event, command) => {
      if (command === "new-window") {
        createWindow();
        return;
      }

      await getSessionForEvent(event)?.handleCommand(command);
    },
    searchWorkspace: (event, query, folderPath, options) =>
      getSessionForEvent(event)?.searchWorkspace(query, folderPath, options) ??
      Promise.resolve([]),
    setEditorMode: (event, mode) => {
      getSessionForEvent(event)?.setEditorMode(mode);
    },
    setActiveDocument: async (event, documentId) => {
      await getSessionForEvent(event)?.setActiveDocument(documentId);
    },
    setActiveTab: async (event, tabId) => {
      await getSessionForEvent(event)?.setActiveTab(tabId);
    },
    openWorkspaceFile: async (event, filePath) => {
      await getSessionForEvent(event)?.openWorkspaceFile(filePath);
    },
    closeTab: async (event, tabId) => {
      await getSessionForEvent(event)?.closeTab(tabId);
    },
    showTabContextMenu: (event, tabId, tabIds) => {
      getSessionForEvent(event)?.showTabContextMenu(tabId, tabIds);
    },
    showWorkspaceContextMenu: (event, targetPath, kind) => {
      getSessionForEvent(event)?.showWorkspaceContextMenu(targetPath, kind);
    },
    updatePaneSizes: (event, paneSizes) => {
      getSessionForEvent(event)?.updatePaneSizes(paneSizes);
    },
    updateDocumentText: (event, documentId, rawText) => {
      getSessionForEvent(event)?.updateDocumentText(documentId, rawText);
    },
    getSettings: async () => {
      return appSettingsSnapshot;
    },
    openAppDataFolder: async () => {
      await shell.openPath(app.getPath("userData"));
    },
    openExternalUrl: async (_event, url) => {
      if (!isExternalWebUrl(url)) {
        getLatestFocusedSession()?.emitStatus("External URL open was ignored.");
        return;
      }

      await shell.openExternal(url);
    },
    openSettingsFile: async () => {
      await writeAppSettings(getAppSettingsPath(), appSettingsSnapshot);
      await shell.openPath(getAppSettingsPath());
    },
    resetSettings: async () => resetStoredAppSettings(),
    updateSettings: async (_event, settings) => {
      return updateStoredAppSettings(getAppSettingsUpdate(settings));
    }
  });
}

function isExternalWebUrl(url: unknown): url is string {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

async function installDevelopmentExtensions(): Promise<void> {
  if (!isDevelopment) {
    return;
  }

  try {
    const installedExtension = session.defaultSession.extensions
      .getAllExtensions()
      .find((extension) => extension.id === reactDeveloperToolsExtensionId);

    if (installedExtension) {
      return;
    }

    const extensionPath = await downloadChromeExtension(
      reactDeveloperToolsExtensionId
    );
    await session.defaultSession.extensions.loadExtension(extensionPath);
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `React DevTools installation failed: ${error.message}`
        : "React DevTools installation failed."
    );
  }
}

export function startDesktopMainProcess(
  options: DesktopMainProcessOptions
): void {
  mainBundleDirectory = options.mainBundleDirectory;
  rendererDevServerUrl = options.rendererDevServerUrl;
  rendererName = options.rendererName;
  isDevelopment = Boolean(rendererDevServerUrl);
  registerDesktopIpcHandlers();

  app.whenReady().then(async () => {
    registerLocalAssetProtocolHandler(
      session.defaultSession,
      getAuthorizedLocalAssetRoots
    );
    setApplicationIcon();
    await installDevelopmentExtensions();
    const settings = await readAppSettings(getAppSettingsPath());
    applyAppSettingsSnapshot(settings);
    applySpellcheckEnabled(spellcheckEnabled);
    Menu.setApplicationMenu(getApplicationMenu());
    await restorePersistedSessionState();
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
    const session = getLatestFocusedSession();

    if (session) {
      if (session.window.isMinimized()) {
        session.window.restore();
      }

      session.window.focus();
    }

    queueOpenTargets(normalizeOpenTargets(argv));
    void flushPendingOpenTargets();
  });

  app.on("before-quit", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();

    void quitApplicationWithSessionPersistence();
  });

  app.on("window-all-closed", () => {
    for (const session of sessions.values()) {
      session.dispose();
    }

    sessions.clear();

    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
