import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  type Callback = (...args: unknown[]) => unknown;
  type MockFunction = ReturnType<typeof vi.fn>;
  type MockWebContents = {
    id: number;
    reload: MockFunction;
    reloadIgnoringCache: MockFunction;
    session: { setSpellCheckerEnabled: MockFunction };
  };
  type MockWindow = {
    id: number;
    webContents: MockWebContents;
    close: MockFunction;
    focus: MockFunction;
    isDestroyed: MockFunction;
    isMinimized: MockFunction;
    on: MockFunction;
    restore: MockFunction;
    handlers: Map<string, Callback>;
    options: unknown;
  };
  type MockSession = {
    handleCommand: MockFunction;
    closeWindowWithProtection: MockFunction;
  };
  type MenuBuild = {
    onCommand: (command: string) => Promise<void> | void;
  };
  type IpcHandlers = {
    runCommand: (
      event: { sender: MockWebContents },
      command: string
    ) => Promise<void>;
  };
  const appHandlers = new Map<string, Callback>();
  const menuBuilds: MenuBuild[] = [];
  const windows: MockWindow[] = [];
  const sessions: MockSession[] = [];
  const order: string[] = [];
  let ipcHandlers: IpcHandlers;
  let flushResult = true;
  let protectionResult = true;

  const app = {
    dock: { setIcon: vi.fn() },
    getPath: vi.fn((name: string) => `/test/${name}`),
    isReady: vi.fn(() => true),
    on: vi.fn((event: string, callback: Callback) =>
      appHandlers.set(event, callback)
    ),
    quit: vi.fn(() => order.push("quit")),
    requestSingleInstanceLock: vi.fn(() => true),
    whenReady: vi.fn((callback: Callback) => Promise.resolve().then(callback))
  };

  const BrowserWindow = {
    fromWebContents: vi.fn(
      (webContents: MockWebContents) =>
        windows.find((window) => window.webContents === webContents) ?? null
    ),
    getAllWindows: vi.fn(() => windows),
    getFocusedWindow: vi.fn(() => null)
  };

  function createWindow(options: unknown) {
    const handlers = new Map<string, Callback>();
    const id = windows.length + 1;
    const webContents = {
      id: id + 100,
      reload: vi.fn(),
      reloadIgnoringCache: vi.fn(),
      session: { setSpellCheckerEnabled: vi.fn() }
    };
    const window = {
      id,
      webContents,
      close: vi.fn(),
      focus: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      on: vi.fn((event: string, callback: Callback) =>
        handlers.set(event, callback)
      ),
      restore: vi.fn(),
      handlers,
      options
    };
    windows.push(window);
    return window;
  }

  class DesktopWindowSession {
    window: MockWindow;
    handleCommand = vi.fn(async (command: string) =>
      order.push(`command:${this.window.id}:${command}`)
    );
    closeWindowWithProtection = vi.fn(async () => {
      order.push(`protect:${this.window.id}`);
      return protectionResult;
    });
    clearAutosaveTimers = vi.fn();
    convertActiveDocumentLineEndings = vi.fn();
    dispose = vi.fn();
    emitInitialState = vi.fn();
    emitSettingsChanged = vi.fn();
    emitStatus = vi.fn();
    getAuthorizedAssetRoots = vi.fn(() => []);
    getProtectedDocuments = vi.fn(() => []);
    handleOpenTarget = vi.fn();
    hasActiveDocument = vi.fn(() => true);
    refreshSettingsSensitiveState = vi.fn();
    restorePersistedState = vi.fn();
    searchWorkspace = vi.fn();
    setActiveDocument = vi.fn();
    setActiveTab = vi.fn();
    setEditorMode = vi.fn();
    openWorkspaceFile = vi.fn();
    closeTab = vi.fn();
    showTabContextMenu = vi.fn();
    showWorkspaceContextMenu = vi.fn();
    updatePaneSizes = vi.fn();
    updateDocumentText = vi.fn();

    constructor(dependencies: { window: MockWindow }) {
      this.window = dependencies.window;
      sessions.push(this);
    }
  }

  class FlushCoordinator {
    request = vi.fn(async (webContents: MockWebContents) => {
      order.push(`flush:${webContents.id - 100}`);
      return flushResult;
    });
    acknowledge = vi.fn();
    cancelSender = vi.fn();
  }

  class SessionStatePersistence {
    request = vi.fn(async () => order.push("persist"));
  }

  return {
    app,
    appHandlers,
    BrowserWindow,
    createWindow,
    DesktopWindowSession,
    FlushCoordinator,
    SessionStatePersistence,
    menuBuilds,
    windows,
    sessions,
    order,
    get ipcHandlers() {
      return ipcHandlers;
    },
    setIpcHandlers(value: IpcHandlers) {
      ipcHandlers = value;
    },
    setFlushResult(value: boolean) {
      flushResult = value;
    },
    setProtectionResult(value: boolean) {
      protectionResult = value;
    },
    reset() {
      appHandlers.clear();
      menuBuilds.length = 0;
      windows.length = 0;
      sessions.length = 0;
      order.length = 0;
      ipcHandlers = undefined;
      flushResult = true;
      protectionResult = true;
      vi.clearAllMocks();
    }
  };
});

vi.mock("electron", () => ({
  app: harness.app,
  BrowserWindow: harness.BrowserWindow,
  Menu: { setApplicationMenu: vi.fn() },
  nativeImage: { createFromPath: vi.fn(() => ({ isEmpty: () => true })) },
  session: { defaultSession: { extensions: { getAllExtensions: () => [] } } },
  shell: { openExternal: vi.fn(), openPath: vi.fn() }
}));
vi.mock("electron-squirrel-startup", () => ({ default: false }));
vi.mock("electron-devtools-installer/dist/downloadChromeExtension.js", () => ({
  downloadChromeExtension: vi.fn()
}));
vi.mock("@pluma/core-desktop", () => ({ DesktopFileSystemAdapter: class {} }));
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
vi.mock("../../src/main/assets/localAssetProtocol", () => ({
  registerLocalAssetProtocolHandler: vi.fn(),
  registerLocalAssetProtocolScheme: vi.fn()
}));
vi.mock("../../src/main/persistence/appDraftStorage", () => ({
  createAppDraftStorage: vi.fn(() => ({}))
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
  buildApplicationMenu: vi.fn(
    (options: { onCommand: (command: string) => Promise<void> | void }) => {
      harness.menuBuilds.push(options);
      return {};
    }
  )
}));
vi.mock("../../src/main/ipc/registerIpcHandlers", () => ({
  registerIpcHandlers: vi.fn(
    (handlers: {
      runCommand: (
        event: { sender: { id: number } },
        command: string
      ) => Promise<void>;
    }) => harness.setIpcHandlers(handlers)
  )
}));
vi.mock("../../src/main/ipc/documentTextFlushCoordinator", () => ({
  DocumentTextFlushCoordinator: harness.FlushCoordinator
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
vi.mock("../../src/main/session/sessionStatePersistence", () => ({
  SessionStatePersistence: harness.SessionStatePersistence,
  writeDesktopSessionState: vi.fn()
}));
vi.mock("../../src/main/windows/createMainWindow", () => ({
  createMainWindow: harness.createWindow
}));
vi.mock("../../src/main/windows/DesktopWindowSession", () => ({
  DesktopWindowSession: harness.DesktopWindowSession
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

describe("desktopMainController", () => {
  beforeEach(() => {
    vi.resetModules();
    harness.reset();
  });

  it("routes menu commands to the latest focused window", async () => {
    await startController();
    await harness.menuBuilds.at(-1).onCommand("new-window");
    harness.windows[0].handlers.get("focus")?.();
    await harness.menuBuilds.at(-1).onCommand("save");
    await vi.waitFor(() =>
      expect(harness.sessions[0].handleCommand).toHaveBeenCalledWith("save")
    );
    expect(harness.sessions[1].handleCommand).not.toHaveBeenCalled();
  });

  it("routes IPC commands to the sender window", async () => {
    await startController();
    await harness.menuBuilds.at(-1).onCommand("new-window");
    await harness.ipcHandlers.runCommand(
      { sender: harness.windows[0].webContents },
      "find"
    );
    expect(harness.sessions[0].handleCommand).toHaveBeenCalledWith("find");
    expect(harness.sessions[1].handleCommand).not.toHaveBeenCalled();
  });

  it("flushes document text before a native save command", async () => {
    await startController();
    harness.menuBuilds.at(-1).onCommand("save");
    await vi.waitFor(() => expect(harness.order).toContain("command:1:save"));
    expect(harness.order).toEqual(["flush:1", "command:1:save"]);
  });

  it("flushes, protects, persists, and quits in order", async () => {
    await startController();
    await harness.menuBuilds.at(-1).onCommand("new-window");
    harness.appHandlers.get("before-quit")?.({ preventDefault: vi.fn() });
    await vi.waitFor(() => expect(harness.app.quit).toHaveBeenCalled());
    expect(harness.order).toEqual([
      "flush:1",
      "flush:2",
      "protect:1",
      "protect:2",
      "persist",
      "quit"
    ]);
  });

  it("cancels quit when a window rejects protection", async () => {
    await startController();
    harness.setProtectionResult(false);
    harness.appHandlers.get("before-quit")?.({ preventDefault: vi.fn() });
    await vi.waitFor(() =>
      expect(harness.sessions[0].closeWindowWithProtection).toHaveBeenCalled()
    );
    expect(harness.order).toEqual(["flush:1", "protect:1"]);
    expect(harness.app.quit).not.toHaveBeenCalled();
  });

  it("cancels quit before protection when document text cannot flush", async () => {
    await startController();
    harness.setFlushResult(false);
    harness.appHandlers.get("before-quit")?.({ preventDefault: vi.fn() });
    await vi.waitFor(() => expect(harness.order).toContain("flush:1"));
    expect(harness.order).toEqual(["flush:1"]);
    expect(
      harness.sessions[0].closeWindowWithProtection
    ).not.toHaveBeenCalled();
    expect(harness.app.quit).not.toHaveBeenCalled();
  });
});
