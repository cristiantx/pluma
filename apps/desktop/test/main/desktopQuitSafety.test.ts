import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  type Handler = (...args: never[]) => unknown;
  const handlers = new Map<string, Handler>();
  const order: string[] = [];
  const windows: Array<ReturnType<typeof createWindow>> = [];
  const sessions: DesktopWindowSession[] = [];
  let persistenceError: Error | null = null;

  const app = {
    dock: { setIcon: vi.fn() },
    getPath: vi.fn(() => "/test"),
    isReady: vi.fn(() => true),
    on: vi.fn((event: string, handler: Handler) =>
      handlers.set(event, handler)
    ),
    quit: vi.fn(() => order.push("quit")),
    requestSingleInstanceLock: vi.fn(() => true),
    whenReady: vi.fn((handler: Handler) => Promise.resolve().then(handler))
  };

  function createWindow() {
    const id = windows.length + 1;
    const window = {
      id,
      close: vi.fn(),
      focus: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      on: vi.fn(),
      restore: vi.fn(),
      webContents: {
        id,
        reload: vi.fn(),
        reloadIgnoringCache: vi.fn(),
        session: { setSpellCheckerEnabled: vi.fn() }
      }
    };
    windows.push(window);
    return window;
  }

  class DesktopWindowSession {
    window: ReturnType<typeof createWindow>;
    closeWindowWithProtection = vi.fn(async () => {
      order.push("protect");
      return true;
    });
    clearAutosaveTimers = vi.fn();
    dispose = vi.fn();
    emitInitialState = vi.fn();
    emitSettingsChanged = vi.fn();
    emitStatus = vi.fn();
    getAuthorizedAssetRoots = vi.fn(() => []);
    getProtectedDocuments = vi.fn(() => []);
    handleOpenTarget = vi.fn();
    refreshSettingsSensitiveState = vi.fn();
    restorePersistedState = vi.fn();

    constructor(dependencies: { window: ReturnType<typeof createWindow> }) {
      this.window = dependencies.window;
      sessions.push(this);
    }
  }

  class FlushCoordinator {
    request = vi.fn(async () => {
      order.push("flush");
      return true;
    });
    acknowledge = vi.fn();
    cancelSender = vi.fn();
  }

  class Persistence {
    request = vi.fn(async () => {
      order.push("persist");
      if (persistenceError) throw persistenceError;
    });
  }

  return {
    app,
    handlers,
    order,
    windows,
    sessions,
    createWindow,
    DesktopWindowSession,
    FlushCoordinator,
    Persistence,
    setPersistenceError(error: Error | null) {
      persistenceError = error;
    },
    reset() {
      handlers.clear();
      order.length = 0;
      windows.length = 0;
      sessions.length = 0;
      persistenceError = null;
      vi.clearAllMocks();
    }
  };
});

vi.mock("electron", () => ({
  app: harness.app,
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getAllWindows: () => harness.windows,
    getFocusedWindow: vi.fn()
  },
  dialog: {},
  Menu: { setApplicationMenu: vi.fn() },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
  session: { defaultSession: { extensions: { getAllExtensions: () => [] } } },
  shell: { openExternal: vi.fn(), openPath: vi.fn() }
}));
vi.mock("electron-squirrel-startup", () => ({ default: false }));
vi.mock("electron-devtools-installer/dist/downloadChromeExtension.js", () => ({
  downloadChromeExtension: vi.fn()
}));
vi.mock("@pluma/core-desktop", () => ({
  DesktopFileSystemAdapter: class {}
}));
vi.mock("@pluma/ui/settings", () => ({
  defaultAppSettings: {
    autosaveEnabled: true,
    defaultLineEnding: "system",
    openExportedFile: false,
    restorePreviousSession: false,
    spellcheckEnabled: true,
    workspaceRespectGitIgnore: false,
    workspaceShowHiddenFiles: true
  }
}));
vi.mock("../../src/main/windows/createMainWindow", () => ({
  createMainWindow: harness.createWindow
}));
vi.mock("../../src/main/windows/DesktopWindowSession", () => ({
  DesktopWindowSession: harness.DesktopWindowSession
}));
vi.mock("../../src/main/ipc/documentTextFlushCoordinator", () => ({
  DocumentTextFlushCoordinator: harness.FlushCoordinator
}));
vi.mock("../../src/main/session/sessionStatePersistence", () => ({
  SessionStatePersistence: harness.Persistence,
  writeDesktopSessionState: vi.fn()
}));
vi.mock("../../src/main/persistence/appPersistence", () => ({
  readAppSettings: vi.fn(async () => ({
    autosaveEnabled: true,
    defaultLineEnding: "system",
    openExportedFile: false,
    restorePreviousSession: false,
    spellcheckEnabled: true,
    workspaceRespectGitIgnore: false,
    workspaceShowHiddenFiles: true
  })),
  readPersistedSessionState: vi.fn(),
  writeAppSettings: vi.fn()
}));
vi.mock("../../src/main/menus/applicationMenu", () => ({
  buildApplicationMenu: vi.fn(() => ({}))
}));
vi.mock("../../src/main/ipc/registerIpcHandlers", () => ({
  registerIpcHandlers: vi.fn()
}));
vi.mock("../../src/main/assets/localAssetProtocol", () => ({
  registerLocalAssetProtocolHandler: vi.fn(),
  registerLocalAssetProtocolScheme: vi.fn()
}));
vi.mock("../../src/main/persistence/appDraftStorage", () => ({
  createAppDraftStorage: vi.fn(() => ({}))
}));
vi.mock("../../src/main/markdown/markdownAnalysisService", () => ({
  MarkdownAnalysisService: class {
    dispose() {}
  }
}));
vi.mock("../../src/main/settings/appSettingsUpdate", () => ({
  getAppSettingsUpdate: (value: unknown) => value
}));
vi.mock("../../src/main/session/quitPersistence", () => ({
  shouldPersistAfterWindowClosed: () => true,
  shouldRouteWindowCloseThroughAppQuit: () => false
}));

async function startController() {
  const { startDesktopMainProcess } =
    await import("../../src/main/desktopMainController");
  startDesktopMainProcess({
    mainBundleDirectory: "/app/build",
    rendererDevServerUrl: undefined,
    rendererName: "main"
  });
  await vi.waitFor(() => expect(harness.sessions).toHaveLength(1));
}

describe("desktop quit safety", () => {
  beforeEach(() => {
    vi.resetModules();
    harness.reset();
  });

  it("coalesces concurrent before-quit events into one quit operation", async () => {
    await startController();
    const event = { preventDefault: vi.fn() };

    harness.handlers.get("before-quit")?.(event as never);
    harness.handlers.get("before-quit")?.(event as never);

    await vi.waitFor(() => expect(harness.app.quit).toHaveBeenCalledTimes(1));
    expect(harness.order).toEqual(["flush", "protect", "persist", "quit"]);
  });

  it("reports persistence failure and allows a later quit retry", async () => {
    await startController();
    const persistenceError = new Error("disk unavailable");
    const event = { preventDefault: vi.fn() };

    harness.setPersistenceError(persistenceError);
    harness.handlers.get("before-quit")?.(event as never);

    await vi.waitFor(() =>
      expect(harness.sessions[0]?.emitStatus).toHaveBeenCalledWith(
        expect.stringMatching(/save|session|persist|quit/i)
      )
    );
    expect(harness.app.quit).not.toHaveBeenCalled();

    harness.setPersistenceError(null);
    harness.handlers.get("before-quit")?.(event as never);

    await vi.waitFor(() => expect(harness.app.quit).toHaveBeenCalledTimes(1));
    expect(harness.order).toEqual([
      "flush",
      "protect",
      "persist",
      "flush",
      "protect",
      "persist",
      "quit"
    ]);
  });
});
