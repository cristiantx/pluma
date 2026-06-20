import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  session,
  shell,
  type IpcMainInvokeEvent
} from "electron";
import path from "node:path";

import { DesktopFileSystemAdapter } from "@pluma/core-desktop";
import {
  defaultAppSettings,
  isDefaultLineEnding,
  isEditorWidthPreference,
  isRichEditorDensity,
  isSourceEditorFontFamily,
  isSourceEditorFontSize,
  isSourceEditorTabSize,
  isSplitViewOrder,
  isThemePreference,
  type AppSettings,
  type DefaultLineEnding
} from "@pluma/ui";
import { downloadChromeExtension } from "electron-devtools-installer/dist/downloadChromeExtension.js";
import started from "electron-squirrel-startup";

import type { CommandName } from "../shared/shellState";
import {
  isMeaningfulPersistedWindowState,
  readAppSettings,
  readPersistedSessionState,
  writeAppSettings,
  writePersistedSessionState,
  type PersistedWindowSessionState
} from "./persistence/appPersistence";
import { createAppDraftStorage } from "./persistence/appDraftStorage";
import { buildApplicationMenu } from "./menus/applicationMenu";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import {
  shouldPersistAfterWindowClosed,
  shouldRouteWindowCloseThroughAppQuit
} from "./session/quitPersistence";
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
let workspaceShowHiddenFiles = true;
let isDevelopment = false;
let isQuitting = false;
let latestFocusedWindowId: number | null = null;
let pendingOpenTargets: string[] = [];

const fileSystem = new DesktopFileSystemAdapter();
const sessions = new Map<number, DesktopWindowSession>();
const windowsAllowedToClose = new Set<number>();
const selfWritePaths = new Set<string>();
const sessionStateFileName = "session-state.json";
const appSettingsFileName = "settings.json";
const autosaveDelayMs = 900;
const draftsDirectoryName = "drafts";
const reactDeveloperToolsExtensionId = "fmkadmapgofadopljbjfkapdkoienihi";

if (started) {
  app.quit();
}

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

async function persistSessionState(): Promise<void> {
  if (!app.isReady()) {
    return;
  }

  const meaningfulSessions = getOrderedSessions()
    .map((session) => session.getPersistedState())
    .filter(isMeaningfulPersistedWindowState);
  const latestSession = getLatestFocusedSession();
  const latestState = latestSession?.getPersistedState() ?? null;
  const activeWindowIndex =
    latestState && isMeaningfulPersistedWindowState(latestState)
      ? Math.max(
          0,
          meaningfulSessions.findIndex((state) =>
            arePersistedWindowStatesEqual(state, latestState)
          )
        )
      : 0;

  await writePersistedSessionState(getSessionStatePath(), {
    activeWindowIndex,
    windows: meaningfulSessions
  });
}

function persistSessionStateSoon(): void {
  void persistSessionState().catch((error) => {
    getLatestFocusedSession()?.emitStatus(
      error instanceof Error
        ? `Failed to save session state: ${error.message}`
        : "Failed to save session state."
    );
  });
}

function arePersistedWindowStatesEqual(
  left: PersistedWindowSessionState,
  right: PersistedWindowSessionState
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getOrderedSessions(): DesktopWindowSession[] {
  return [...sessions.values()].filter(
    (session) => !session.window.isDestroyed()
  );
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
  event: IpcMainInvokeEvent
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
  const currentSettings = await readAppSettings(getAppSettingsPath());
  const nextSettings: AppSettings = {
    ...currentSettings,
    ...update
  };

  await writeAppSettings(getAppSettingsPath(), nextSettings);
  autosaveEnabled = nextSettings.autosaveEnabled;
  defaultLineEnding = nextSettings.defaultLineEnding;
  openExportedFile = nextSettings.openExportedFile;
  restorePreviousSession = nextSettings.restorePreviousSession;
  spellcheckEnabled = nextSettings.spellcheckEnabled;
  workspaceShowHiddenFiles = nextSettings.workspaceShowHiddenFiles;

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
    nextSettings.workspaceShowHiddenFiles
  ) {
    for (const session of sessions.values()) {
      void session.refreshSettingsSensitiveState();
    }
  }

  emitSettingsChanged(nextSettings);

  Menu.setApplicationMenu(getApplicationMenu());

  return nextSettings;
}

async function resetStoredAppSettings(): Promise<AppSettings> {
  await writeAppSettings(getAppSettingsPath(), defaultAppSettings);
  return updateStoredAppSettings(defaultAppSettings);
}

function getAppSettingsUpdate(settings: unknown): Partial<AppSettings> {
  if (!isRecord(settings)) {
    return {};
  }

  return {
    ...(typeof settings.autosaveEnabled === "boolean"
      ? { autosaveEnabled: settings.autosaveEnabled }
      : {}),
    ...(typeof settings.spellcheckEnabled === "boolean"
      ? { spellcheckEnabled: settings.spellcheckEnabled }
      : {}),
    ...(typeof settings.openExportedFile === "boolean"
      ? { openExportedFile: settings.openExportedFile }
      : {}),
    ...(typeof settings.restorePreviousSession === "boolean"
      ? { restorePreviousSession: settings.restorePreviousSession }
      : {}),
    ...(typeof settings.workspaceSearchCaseSensitive === "boolean"
      ? { workspaceSearchCaseSensitive: settings.workspaceSearchCaseSensitive }
      : {}),
    ...(typeof settings.workspaceSearchRegexp === "boolean"
      ? { workspaceSearchRegexp: settings.workspaceSearchRegexp }
      : {}),
    ...(typeof settings.workspaceSearchWholeWord === "boolean"
      ? { workspaceSearchWholeWord: settings.workspaceSearchWholeWord }
      : {}),
    ...(typeof settings.workspaceShowHiddenFiles === "boolean"
      ? { workspaceShowHiddenFiles: settings.workspaceShowHiddenFiles }
      : {}),
    ...(isEditorWidthPreference(settings.richEditorWidth)
      ? { richEditorWidth: settings.richEditorWidth }
      : {}),
    ...(isEditorWidthPreference(settings.sourceEditorWidth)
      ? { sourceEditorWidth: settings.sourceEditorWidth }
      : {}),
    ...(isSourceEditorFontFamily(settings.sourceEditorFontFamily)
      ? { sourceEditorFontFamily: settings.sourceEditorFontFamily }
      : {}),
    ...(isSourceEditorColorSchemeSetting(settings.sourceEditorColorScheme)
      ? { sourceEditorColorScheme: settings.sourceEditorColorScheme }
      : {}),
    ...(isSourceEditorFontSize(settings.sourceEditorFontSize)
      ? { sourceEditorFontSize: settings.sourceEditorFontSize }
      : {}),
    ...(typeof settings.sourceEditorLineNumbers === "boolean"
      ? { sourceEditorLineNumbers: settings.sourceEditorLineNumbers }
      : {}),
    ...(isSourceEditorTabSize(settings.sourceEditorTabSize)
      ? { sourceEditorTabSize: settings.sourceEditorTabSize }
      : {}),
    ...(typeof settings.sourceEditorWordWrap === "boolean"
      ? { sourceEditorWordWrap: settings.sourceEditorWordWrap }
      : {}),
    ...(isRichEditorDensity(settings.richEditorDensity)
      ? { richEditorDensity: settings.richEditorDensity }
      : {}),
    ...(isSplitViewOrder(settings.splitViewOrder)
      ? { splitViewOrder: settings.splitViewOrder }
      : {}),
    ...(isDefaultLineEnding(settings.defaultLineEnding)
      ? { defaultLineEnding: settings.defaultLineEnding }
      : {}),
    ...(typeof settings.themePreference === "string" &&
    isThemePreference(settings.themePreference)
      ? { themePreference: settings.themePreference }
      : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSourceEditorColorSchemeSetting(
  value: unknown
): value is AppSettings["sourceEditorColorScheme"] {
  return (
    value === "follow-theme" ||
    value === "pluma-dark" ||
    value === "pluma-light"
  );
}

async function handleMenuCommand(command: CommandName): Promise<void> {
  if (command === "new-window") {
    createWindow();
    return;
  }

  const session = getLatestFocusedSession() ?? createWindow();
  await session.handleCommand(command);
}

function handleConvertLineEndings(target: "crlf" | "lf"): void {
  getLatestFocusedSession()?.convertActiveDocumentLineEndings(target);
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
    onConvertLineEndings: handleConvertLineEndings,
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
    getWorkspaceShowHiddenFiles: () => workspaceShowHiddenFiles,
    isDevelopment,
    onMenuStateChange: refreshApplicationMenu,
    onPersistSessionState: persistSessionStateSoon,
    selfWritePaths,
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

      const session = sessions.get(window.id);
      if (!session || session.getProtectedDocuments().length === 0) {
        return;
      }

      event.preventDefault();

      void session.closeWindowWithProtection().then((canClose) => {
        if (canClose) {
          windowsAllowedToClose.add(window.id);
          window.close();
        }
      });
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
  if (!(await confirmQuitAcrossWindows())) {
    return;
  }

  isQuitting = true;
  await persistSessionState();
  app.quit();
}

function registerDesktopIpcHandlers(): void {
  registerIpcHandlers({
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
    setActiveDocument: (event, documentId) => {
      getSessionForEvent(event)?.setActiveDocument(documentId);
    },
    setActiveTab: (event, tabId) => {
      getSessionForEvent(event)?.setActiveTab(tabId);
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
      const settings = await readAppSettings(getAppSettingsPath());
      autosaveEnabled = settings.autosaveEnabled;
      defaultLineEnding = settings.defaultLineEnding;
      openExportedFile = settings.openExportedFile;
      restorePreviousSession = settings.restorePreviousSession;
      spellcheckEnabled = settings.spellcheckEnabled;
      workspaceShowHiddenFiles = settings.workspaceShowHiddenFiles;
      applySpellcheckEnabled(spellcheckEnabled);

      return settings;
    },
    openAppDataFolder: async () => {
      await shell.openPath(app.getPath("userData"));
    },
    openSettingsFile: async () => {
      await writeAppSettings(
        getAppSettingsPath(),
        await readAppSettings(getAppSettingsPath())
      );
      await shell.openPath(getAppSettingsPath());
    },
    resetSettings: async () => resetStoredAppSettings(),
    updateSettings: async (_event, settings) => {
      return updateStoredAppSettings(getAppSettingsUpdate(settings));
    }
  });
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
    setApplicationIcon();
    await installDevelopmentExtensions();
    const settings = await readAppSettings(getAppSettingsPath());
    autosaveEnabled = settings.autosaveEnabled;
    defaultLineEnding = settings.defaultLineEnding;
    openExportedFile = settings.openExportedFile;
    restorePreviousSession = settings.restorePreviousSession;
    spellcheckEnabled = settings.spellcheckEnabled;
    workspaceShowHiddenFiles = settings.workspaceShowHiddenFiles;
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
