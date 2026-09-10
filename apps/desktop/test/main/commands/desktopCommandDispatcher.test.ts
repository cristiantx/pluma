import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDesktopCommandDispatcher,
  type DesktopCommandDispatcherDependencies,
  type DesktopCommandSession
} from "../../../src/main/commands/desktopCommandDispatcher";

type FakeSession = DesktopCommandSession & {
  documentId: string | null;
  destroyed: boolean;
  handleCommand: ReturnType<typeof vi.fn>;
  convertActiveDocumentLineEndings: ReturnType<typeof vi.fn>;
  window: DesktopCommandSession["window"] & {
    webContents: {
      reload: ReturnType<typeof vi.fn>;
      reloadIgnoringCache: ReturnType<typeof vi.fn>;
    };
  };
};

function createSession(documentId: string | null = "document-1"): FakeSession {
  const session: FakeSession = {
    documentId,
    destroyed: false,
    window: {
      isDestroyed: () => session.destroyed,
      webContents: {
        reload: vi.fn(),
        reloadIgnoringCache: vi.fn()
      }
    },
    hasActiveDocument: () => session.documentId !== null,
    getCommandDocumentId: () => session.documentId,
    handleCommand: vi.fn(async () => undefined),
    convertActiveDocumentLineEndings: vi.fn()
  };

  return session;
}

function createHarness() {
  const focusedSession = createSession("focused-document");
  const createdSession = createSession("created-document");
  const dependencies: DesktopCommandDispatcherDependencies = {
    isDevelopment: true,
    getFocusedSession: vi.fn(() => focusedSession),
    createWindow: vi.fn(() => createdSession),
    flushSession: vi.fn(async () => true),
    setAutosaveEnabled: vi.fn(async () => undefined),
    setSpellcheckEnabled: vi.fn(async () => undefined)
  };

  return {
    createdSession,
    dependencies,
    dispatch: createDesktopCommandDispatcher(dependencies),
    focusedSession
  };
}

describe("createDesktopCommandDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores invalid, native, and Markdown editor commands from IPC", async () => {
    const { dependencies, dispatch, focusedSession } = createHarness();

    await dispatch("not-a-command", {
      kind: "renderer",
      session: focusedSession
    });
    await dispatch(
      { id: "save", unexpected: true },
      {
        kind: "renderer",
        session: focusedSession
      }
    );
    await dispatch("native-copy", {
      kind: "renderer",
      session: focusedSession
    });
    await dispatch("toggle-bold", {
      kind: "renderer",
      session: focusedSession
    });

    expect(focusedSession.handleCommand).not.toHaveBeenCalled();
    expect(dependencies.createWindow).not.toHaveBeenCalled();
    expect(dependencies.flushSession).not.toHaveBeenCalled();
  });

  it("does not let a missing renderer session create a new window", async () => {
    const { dependencies, dispatch } = createHarness();

    await dispatch("new-window", { kind: "renderer", session: null });

    expect(dependencies.createWindow).not.toHaveBeenCalled();
  });

  it("uses the focused session for menus and the sender session for IPC", async () => {
    const { dependencies, dispatch, focusedSession } = createHarness();
    const senderSession = createSession("sender-document");

    await dispatch("save", { kind: "menu" });
    await dispatch("save", { kind: "renderer", session: senderSession });

    expect(dependencies.getFocusedSession).toHaveBeenCalledTimes(1);
    expect(dependencies.flushSession).toHaveBeenCalledWith(focusedSession);
    expect(focusedSession.handleCommand).toHaveBeenCalledWith("save");
    expect(senderSession.handleCommand).toHaveBeenCalledWith("save");
    expect(dependencies.flushSession).not.toHaveBeenCalledWith(senderSession);
  });

  it("awaits a menu flush before invoking the command", async () => {
    const { dependencies, focusedSession } = createHarness();
    let finishFlush: ((result: boolean) => void) | undefined;
    dependencies.flushSession = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishFlush = resolve;
        })
    );
    const dispatchWithDeferredFlush =
      createDesktopCommandDispatcher(dependencies);

    const result = dispatchWithDeferredFlush("save", { kind: "menu" });
    await Promise.resolve();

    expect(focusedSession.handleCommand).not.toHaveBeenCalled();
    finishFlush?.(true);
    await result;

    expect(focusedSession.handleCommand).toHaveBeenCalledWith("save");
  });

  it("stops a menu command when flushing fails", async () => {
    const { dependencies, dispatch, focusedSession } = createHarness();
    vi.mocked(dependencies.flushSession).mockResolvedValue(false);

    await dispatch("save", { kind: "menu" });

    expect(focusedSession.handleCommand).not.toHaveBeenCalled();
  });

  it("does not save if the active document changes during the flush", async () => {
    const { dependencies, dispatch, focusedSession } = createHarness();
    vi.mocked(dependencies.flushSession).mockImplementation(async () => {
      focusedSession.documentId = "another-document";
      return true;
    });

    await dispatch("save", { kind: "menu" });

    expect(focusedSession.handleCommand).not.toHaveBeenCalled();
  });

  it("does not save if the window is destroyed during the flush", async () => {
    const { dependencies, dispatch, focusedSession } = createHarness();
    vi.mocked(dependencies.flushSession).mockImplementation(async () => {
      focusedSession.destroyed = true;
      return true;
    });

    await dispatch("save", { kind: "menu" });

    expect(focusedSession.handleCommand).not.toHaveBeenCalled();
  });

  it("dispatches normal and force reload through their matching webContents APIs", async () => {
    const { dispatch, focusedSession } = createHarness();

    await dispatch("reload-window", { kind: "menu" });
    await dispatch("force-reload-window", {
      kind: "renderer",
      session: focusedSession
    });

    expect(focusedSession.window.webContents.reload).toHaveBeenCalledTimes(1);
    expect(
      focusedSession.window.webContents.reloadIgnoringCache
    ).toHaveBeenCalledTimes(1);
    expect(focusedSession.handleCommand).not.toHaveBeenCalled();
  });

  it("dispatches application setting booleans without a session flush", async () => {
    const { dependencies, dispatch } = createHarness();

    await dispatch(
      { id: "set-autosave-enabled", args: { enabled: false } },
      { kind: "menu" }
    );
    await dispatch(
      { id: "set-spellcheck-enabled", args: { enabled: true } },
      { kind: "menu" }
    );

    expect(dependencies.setAutosaveEnabled).toHaveBeenCalledWith(false);
    expect(dependencies.setSpellcheckEnabled).toHaveBeenCalledWith(true);
    expect(dependencies.flushSession).not.toHaveBeenCalled();
  });

  it("dispatches validated line-ending payloads to the focused session", async () => {
    const { dependencies, dispatch, focusedSession } = createHarness();

    await dispatch(
      { id: "convert-line-endings", args: { target: "crlf" } },
      { kind: "menu" }
    );

    expect(dependencies.flushSession).toHaveBeenCalledWith(focusedSession);
    expect(
      focusedSession.convertActiveDocumentLineEndings
    ).toHaveBeenCalledWith("crlf");
  });
});
