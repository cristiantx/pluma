import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateMainWindowOptions } from "../../../src/main/windows/createMainWindow";
import type { WindowLifecycleDependencies } from "../../../src/main/windows/windowSessionLifecycle";
import { WindowSessionRegistry } from "../../../src/main/windows/windowSessionRegistry";

const mocks = vi.hoisted(() => {
  type FakeWindow = {
    id: number;
    close: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };
  let options: CreateMainWindowOptions | null = null;
  const window: FakeWindow = {
    id: 17,
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    on: vi.fn()
  };

  class DesktopWindowSession {
    window: FakeWindow;
    dispose = vi.fn();
    emitInitialState = vi.fn();
    getAuthorizedAssetRoots = vi.fn(() => []);
    getProtectedDocuments = vi.fn(() => [{}]);
    closeWindowWithProtection = vi.fn(async () => true);

    constructor(dependencies: { window: FakeWindow }) {
      this.window = dependencies.window;
    }
  }

  return {
    DesktopWindowSession,
    window,
    get options() {
      return options;
    },
    createMainWindow(nextOptions: CreateMainWindowOptions) {
      options = nextOptions;
      return window;
    },
    reset() {
      options = null;
      vi.clearAllMocks();
      window.isDestroyed.mockReturnValue(false);
    }
  };
});

vi.mock("../../../src/main/windows/createMainWindow", () => ({
  createMainWindow: mocks.createMainWindow
}));
vi.mock("../../../src/main/windows/DesktopWindowSession", () => ({
  DesktopWindowSession: mocks.DesktopWindowSession
}));

import { createWindowSessionLifecycle } from "../../../src/main/windows/windowSessionLifecycle";

function createHarness() {
  const sessions = new WindowSessionRegistry({
    getFocusedWindowId: () => null,
    getSenderWindowId: () => null
  });
  const quitCoordinator = {
    isPending: false,
    isQuitting: false
  };
  const flushDocumentText = vi.fn(async () => true);
  const persistSession = vi.fn();
  const requestQuit = vi.fn(async () => undefined);
  const flushCoordinator = { cancelSender: vi.fn() };
  const dependencies = {
    sessions,
    flushCoordinator,
    quitCoordinator,
    settingsController: {
      getSnapshot: () => ({ spellcheckEnabled: true })
    },
    getOptions: () => ({
      mainBundleDirectory: "/app/build",
      rendererDevServerUrl: undefined,
      rendererName: "main"
    }),
    getAppIconPath: () => "/app/icon.png",
    getSessions: () => [session, {}],
    refreshMenu: vi.fn(),
    persistSession,
    requestQuit,
    flushOpenTargets: vi.fn(async () => undefined),
    createWindowDependencies: (window: unknown) => ({ window }),
    flushDocumentText
  } as unknown as WindowLifecycleDependencies;
  const lifecycle = createWindowSessionLifecycle(dependencies);
  const session = lifecycle.createWindow() as unknown as InstanceType<
    typeof mocks.DesktopWindowSession
  >;

  return {
    flushCoordinator,
    flushDocumentText,
    persistSession,
    quitCoordinator,
    requestQuit,
    session,
    sessions
  };
}

describe("window session lifecycle", () => {
  beforeEach(() => {
    mocks.reset();
  });

  it("blocks native close work while an application quit is pending", () => {
    const { flushDocumentText, quitCoordinator, requestQuit, session } =
      createHarness();
    const event = { preventDefault: vi.fn() };
    quitCoordinator.isPending = true;

    mocks.options?.onClose(event as Electron.Event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(flushDocumentText).not.toHaveBeenCalled();
    expect(session.closeWindowWithProtection).not.toHaveBeenCalled();
    expect(requestQuit).not.toHaveBeenCalled();
  });

  it("does not persist an empty session when a window closes during pending quit", () => {
    const {
      flushCoordinator,
      persistSession,
      quitCoordinator,
      session,
      sessions
    } = createHarness();
    quitCoordinator.isPending = true;

    mocks.options?.onClosed({ webContentsId: 29, windowId: 17 });

    expect(session.dispose).toHaveBeenCalledOnce();
    expect(flushCoordinator.cancelSender).toHaveBeenCalledWith(29);
    expect(sessions.get(17)).toBeNull();
    expect(persistSession).not.toHaveBeenCalled();
  });

  it("coalesces duplicate window closes and allows retry after cancellation", async () => {
    const { flushDocumentText, session } = createHarness();
    const event = { preventDefault: vi.fn() };
    session.closeWindowWithProtection.mockResolvedValueOnce(false);

    mocks.options?.onClose(event as Electron.Event);
    mocks.options?.onClose(event as Electron.Event);

    await vi.waitFor(() =>
      expect(session.closeWindowWithProtection).toHaveBeenCalledTimes(1)
    );
    expect(flushDocumentText).toHaveBeenCalledTimes(1);
    expect(mocks.window.close).not.toHaveBeenCalled();

    session.closeWindowWithProtection.mockResolvedValueOnce(true);
    mocks.options?.onClose(event as Electron.Event);

    await vi.waitFor(() => expect(mocks.window.close).toHaveBeenCalledOnce());
    expect(flushDocumentText).toHaveBeenCalledTimes(2);
    expect(session.closeWindowWithProtection).toHaveBeenCalledTimes(2);
  });
});
