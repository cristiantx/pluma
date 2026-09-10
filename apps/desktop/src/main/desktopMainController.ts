import type { WebContents } from "electron";
import {
  app,
  BrowserWindow,
  Menu,
  session,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from "electron";
import path from "node:path";
import { registerDesktopIpcBindings } from "./ipc/desktopIpcBindings";
import { registerDesktopAppLifecycle } from "./runtime/desktopAppLifecycle";
import {
  installDevelopmentExtensions,
  setApplicationIcon
} from "./runtime/desktopNativeIntegration";
import { OpenTargetQueue } from "./runtime/openTargetQueue";
import { DesktopQuitCoordinator } from "./session/desktopQuitCoordinator";
import { restoreDesktopWindows } from "./session/desktopSessionRestoration";
import { DesktopSettingsController } from "./settings/desktopSettingsController";
import { createWindowSessionLifecycle } from "./windows/windowSessionLifecycle";
import { WindowSessionRegistry } from "./windows/windowSessionRegistry";

import { DesktopFileSystemAdapter } from "@pluma/core-desktop";
import { type AppSettings } from "@pluma/ui/settings";
import started from "electron-squirrel-startup";

import {
  registerLocalAssetProtocolHandler,
  registerLocalAssetProtocolScheme
} from "./assets/localAssetProtocol";
import {
  createDesktopCommandDispatcher,
  type DesktopCommandSession
} from "./commands/desktopCommandDispatcher";
import { DocumentTextFlushCoordinator } from "./ipc/documentTextFlushCoordinator";
import { MarkdownAnalysisService } from "./markdown/markdownAnalysisService";
import { buildApplicationMenu } from "./menus/applicationMenu";
import { createAppDraftStorage } from "./persistence/appDraftStorage";
import {
  readAppSettings,
  writeAppSettings
} from "./persistence/appPersistence";
import {
  SessionStatePersistence,
  writeDesktopSessionState
} from "./session/sessionStatePersistence";
import type { DesktopWindowSession } from "./windows/DesktopWindowSession";
import { type DesktopWindowSessionDependencies } from "./windows/DesktopWindowSession";

export type DesktopMainProcessOptions = {
  mainBundleDirectory: string;
  rendererDevServerUrl: string | undefined;
  rendererName: string;
};

let mainBundleDirectory = "";
let rendererDevServerUrl: string | undefined;
let rendererName = "";
let isDevelopment = false;

let markdownAnalysisService: MarkdownAnalysisService | null = null;

const fileSystem = new DesktopFileSystemAdapter();
const sessions = new WindowSessionRegistry<DesktopWindowSession>({
  getFocusedWindowId: () => BrowserWindow.getFocusedWindow()?.id ?? null,
  getSenderWindowId: (sender) =>
    BrowserWindow.fromWebContents(sender as WebContents)?.id ?? null
});
const settingsController = new DesktopSettingsController({
  getSessions: () => [...sessions.values()],
  refreshMenu: () => Menu.setApplicationMenu(getApplicationMenu()),
  write: (settings) => writeAppSettings(getAppSettingsPath(), settings)
});
const openTargets = new OpenTargetQueue({
  getLatestSession: getLatestFocusedSession,
  createWindow
});
const documentTextFlushCoordinator = new DocumentTextFlushCoordinator();

const sessionStateFileName = "session-state.json";
const appSettingsFileName = "settings.json";
const autosaveDelayMs = 900;
const draftsDirectoryName = "drafts";

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

const quitCoordinator = new DesktopQuitCoordinator<DesktopWindowSession>({
  getSessions: getOrderedSessions,
  flush: flushSessionDocumentText,
  persist: () => sessionStatePersistence.request(),
  quit: () => app.quit(),
  reportFailure: (message) => getLatestFocusedSession()?.emitStatus(message)
});

const windowLifecycle = createWindowSessionLifecycle({
  sessions,
  flushCoordinator: documentTextFlushCoordinator,
  quitCoordinator,
  settingsController,
  getOptions: () => ({
    mainBundleDirectory,
    rendererDevServerUrl,
    rendererName
  }),
  getAppIconPath,
  getSessions: getOrderedSessions,
  refreshMenu: refreshApplicationMenu,
  persistSession: persistSessionStateSoon,
  requestQuit: quitApplicationWithSessionPersistence,
  flushOpenTargets: flushPendingOpenTargets,
  createWindowDependencies,
  flushDocumentText: flushSessionDocumentText
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
  return sessions.ordered();
}

function getAuthorizedLocalAssetRoots(): string[] {
  return sessions.authorizedAssetRoots();
}

function getLatestFocusedSession(): DesktopWindowSession | null {
  return sessions.latest();
}

function getSessionForEvent(
  event: IpcMainEvent | IpcMainInvokeEvent
): DesktopWindowSession | null {
  return sessions.forSender(event.sender);
}

function queueOpenTargets(targets: string[]): void {
  openTargets.queue(targets);
}

async function flushPendingOpenTargets(): Promise<void> {
  await openTargets.flush();
}

async function setAutosaveEnabled(enabled: boolean): Promise<void> {
  const nextSettings = await updateStoredAppSettings({
    autosaveEnabled: enabled
  });
  getLatestFocusedSession()?.emitStatus(
    nextSettings.autosaveEnabled ? "Auto Save enabled." : "Auto Save disabled."
  );
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
  return settingsController.update(update);
}

function applyAppSettingsSnapshot(nextSettings: AppSettings): void {
  settingsController.applyInitial(nextSettings);
}

const dispatchCommand = (
  value: unknown,
  origin: Parameters<ReturnType<typeof createDesktopCommandDispatcher>>[1]
) =>
  createDesktopCommandDispatcher({
    isDevelopment,
    getFocusedSession: getLatestFocusedSession,
    createWindow,
    flushSession: (target) => flushSessionDocumentText(target),
    setAutosaveEnabled,
    setSpellcheckEnabled
  })(value, origin);

async function flushSessionDocumentText(
  session: DesktopCommandSession
): Promise<boolean> {
  const target = getOrderedSessions().find(
    (candidate) => candidate === session
  );
  if (!target) return false;
  const flushed = await documentTextFlushCoordinator.request(
    target.window.webContents
  );

  if (!flushed) {
    target.emitStatus(
      "Could not synchronize the latest document edits. Try the action again."
    );
  }

  return flushed;
}

function getApplicationMenu(): Menu {
  const latestSession = getLatestFocusedSession();

  return buildApplicationMenu({
    autosaveEnabled: settingsController.getSnapshot().autosaveEnabled,
    commandAvailability: {
      hasActiveDocument: latestSession?.hasActiveDocument() ?? false
    },
    isDevelopment,
    spellcheckEnabled: settingsController.getSnapshot().spellcheckEnabled,
    onCommand: (command) => void dispatchCommand(command, { kind: "menu" })
  });
}

function refreshApplicationMenu(): void {
  if (app.isReady()) {
    Menu.setApplicationMenu(getApplicationMenu());
  }
}

function createWindowDependencies(
  window: BrowserWindow,
  waitForRendererReady: () => Promise<void>
): DesktopWindowSessionDependencies {
  return {
    appDocumentsPath: app.getPath("documents"),
    draftStorage: createAppDraftStorage(getDraftsDirectory()),
    flushDocumentText: async () => {
      const session = sessions.get(window.id);
      return session ? flushSessionDocumentText(session) : false;
    },
    autosaveDelayMs,
    fileSystem,
    getAutosaveEnabled: () => settingsController.getSnapshot().autosaveEnabled,
    getDefaultLineEnding: () =>
      settingsController.getSnapshot().defaultLineEnding,
    getOpenExportedFile: () =>
      settingsController.getSnapshot().openExportedFile,
    getWorkspaceRespectGitIgnore: () =>
      settingsController.getSnapshot().workspaceRespectGitIgnore,
    getWorkspaceShowHiddenFiles: () =>
      settingsController.getSnapshot().workspaceShowHiddenFiles,
    isDevelopment,
    analyzeMarkdownMode: (rawText) => {
      const service = markdownAnalysisService;

      return service
        ? service.analyze(rawText)
        : Promise.resolve("source-only");
    },
    onMenuStateChange: refreshApplicationMenu,
    onPersistSessionState: persistSessionStateSoon,
    waitForRendererReady,
    window
  };
}

function createWindow(): DesktopWindowSession {
  return windowLifecycle.createWindow();
}

function quitApplicationWithSessionPersistence(): Promise<void> {
  return quitCoordinator.request();
}

export function startDesktopMainProcess(
  options: DesktopMainProcessOptions
): void {
  mainBundleDirectory = options.mainBundleDirectory;
  rendererDevServerUrl = options.rendererDevServerUrl;
  rendererName = options.rendererName;
  isDevelopment = Boolean(rendererDevServerUrl);
  markdownAnalysisService = new MarkdownAnalysisService({
    onError: (message) => getLatestFocusedSession()?.emitStatus(message),
    workerPath: path.join(mainBundleDirectory, "markdownAnalysisWorker.js")
  });
  registerDesktopIpcBindings({
    dispatchCommand,
    flushCoordinator: documentTextFlushCoordinator,
    getAppSettingsPath,
    getLatestFocusedSession,
    getSessionForEvent,
    settingsController
  });

  registerDesktopAppLifecycle({
    sessions,
    quitCoordinator,
    createWindow,
    getLatestSession: getLatestFocusedSession,
    queueOpenTargets,
    flushOpenTargets: flushPendingOpenTargets,
    onReady: async () => {
      registerLocalAssetProtocolHandler(
        session.defaultSession,
        getAuthorizedLocalAssetRoots
      );
      setApplicationIcon(getAppIconPath());
      await installDevelopmentExtensions(isDevelopment);
      const settings = await readAppSettings(getAppSettingsPath());
      applyAppSettingsSnapshot(settings);
      settingsController.applySpellcheck();
      Menu.setApplicationMenu(getApplicationMenu());
      await restoreDesktopWindows({
        enabled: settingsController.getSnapshot().restorePreviousSession,
        sessionStatePath: getSessionStatePath(),
        createWindow
      });
    },
    onWillQuit: () => {
      markdownAnalysisService?.dispose();
      markdownAnalysisService = null;
    }
  });
}
