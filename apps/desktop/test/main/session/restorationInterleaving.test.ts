import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as FileSystemPromises from "node:fs/promises";

vi.mock("electron", () => ({
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn()
  }
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof FileSystemPromises>();

  return {
    ...original,
    stat: vi.fn(async () => ({
      isDirectory: () => false,
      isFile: () => true
    }))
  };
});

vi.mock("../../../src/main/watching/activeFileWatcher", () => ({
  ActiveFileWatcher: class ActiveFileWatcher {
    close = vi.fn();
    update = vi.fn();
  }
}));

import {
  analyzeMarkdownText,
  type DesktopFileLocation,
  type DocumentSession,
  type FileMetadata,
  type FileSystemAdapter
} from "@pluma/core";

import type { AppDraftStorage } from "../../../src/main/persistence/appDraftStorage";
import { DesktopWindowSession } from "../../../src/main/windows/DesktopWindowSession";
import type { DesktopShellSnapshot } from "../../../src/shared/shellState";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

const sessions: DesktopWindowSession[] = [];

function createDeferred(): Deferred {
  let resolve = () => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}

function getMetadata(filePath: string, text: string): FileMetadata {
  return {
    fileId: filePath,
    mtimeMs: text.length,
    size: text.length
  };
}

function createFileSystem(
  files: Record<string, string>
): FileSystemAdapter<DesktopFileLocation> {
  return {
    async getMetadata(location) {
      const text = files[location.path];
      return text === undefined ? null : getMetadata(location.path, text);
    },
    async listDirectory() {
      return [];
    },
    async readText(location) {
      const text = files[location.path];
      if (text === undefined) throw new Error(`Missing ${location.path}`);
      return text;
    },
    async writeTextAtomic(location, text) {
      files[location.path] = text;
      return {
        kind: "success",
        location,
        metadata: getMetadata(location.path, text)
      };
    }
  };
}

function createSession(
  files: Record<string, string>,
  options: {
    analyzeMarkdownMode?: (rawText: string) => Promise<"none" | "source-only">;
    waitForRendererReady?: () => Promise<void>;
  } = {}
) {
  const send = vi.fn();
  const draftStorage: AppDraftStorage = {
    createDraft: vi.fn(),
    deleteDraft: vi.fn(),
    readDraft: vi.fn(async () => null),
    writeDraft: vi.fn()
  };
  const session = new DesktopWindowSession({
    analyzeMarkdownMode:
      options.analyzeMarkdownMode ??
      (async (rawText) => analyzeMarkdownText(rawText).modeConstraint),
    appDocumentsPath: "/tmp",
    autosaveDelayMs: 1,
    draftStorage,
    fileSystem: createFileSystem(files),
    getAutosaveEnabled: () => false,
    getDefaultLineEnding: () => "lf",
    getOpenExportedFile: () => false,
    getWorkspaceRespectGitIgnore: () => false,
    getWorkspaceShowHiddenFiles: () => true,
    isDevelopment: false,
    onMenuStateChange: vi.fn(),
    onPersistSessionState: vi.fn(),
    waitForRendererReady:
      options.waitForRendererReady ?? (() => Promise.resolve()),
    window: {
      isDestroyed: () => false,
      webContents: { send }
    } as never
  });
  sessions.push(session);
  session.emitInitialState();

  return { send, session };
}

function getDocuments(session: DesktopWindowSession): DocumentSession[] {
  return (
    session as unknown as {
      state: { value: DesktopShellSnapshot };
    }
  ).state.value.documents;
}

function persistedState() {
  return {
    activeDocumentPath: "/active.md",
    documentPaths: ["/active.md", "/background.md"],
    editorMode: "source" as const,
    paneSizes: [],
    workspacePath: null
  };
}

describe("restoration interleaving", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const session of sessions.splice(0)) {
      session.dispose();
    }
  });

  it("does not publish restored state after disposal during the renderer-ready wait", async () => {
    const rendererReady = createDeferred();
    const { send, session } = createSession(
      {
        "/active.md": "# Active\n",
        "/background.md": "# Background\n"
      },
      { waitForRendererReady: () => rendererReady.promise }
    );
    const restore = session.restorePersistedState(persistedState());

    await vi.waitFor(() => expect(getDocuments(session)).toHaveLength(1));
    session.dispose();
    send.mockClear();
    rendererReady.resolve();
    await restore;

    expect(send).not.toHaveBeenCalled();
  });

  it("preserves a document opened while background restoration is pending", async () => {
    const backgroundAnalysis = createDeferred();
    const { session } = createSession(
      {
        "/active.md": "# Active\n",
        "/background.md": "# Background\n",
        "/user.md": "# User\n"
      },
      {
        analyzeMarkdownMode: async (rawText) => {
          if (rawText.includes("Background")) {
            await backgroundAnalysis.promise;
          }
          return "none";
        }
      }
    );
    const restore = session.restorePersistedState(persistedState());

    await vi.waitFor(() =>
      expect(getDocuments(session).map(({ id }) => id)).toEqual([
        "desktop:/active.md"
      ])
    );
    await session.handleOpenTarget("/user.md");
    expect(getDocuments(session).map(({ id }) => id)).toContain(
      "desktop:/user.md"
    );

    backgroundAnalysis.resolve();
    await restore;

    expect(getDocuments(session).map(({ id }) => id)).toContain(
      "desktop:/user.md"
    );
  });

  it("does not resurrect a restored document closed during background restoration", async () => {
    const backgroundAnalysis = createDeferred();
    const { session } = createSession(
      {
        "/active.md": "# Active\n",
        "/background.md": "# Background\n"
      },
      {
        analyzeMarkdownMode: async (rawText) => {
          if (rawText.includes("Background")) {
            await backgroundAnalysis.promise;
          }
          return "none";
        }
      }
    );
    const restore = session.restorePersistedState(persistedState());

    await vi.waitFor(() => expect(getDocuments(session)).toHaveLength(1));
    await session.closeTab("desktop:/active.md");
    expect(getDocuments(session)).toEqual([]);

    backgroundAnalysis.resolve();
    await restore;

    expect(getDocuments(session).map(({ id }) => id)).not.toContain(
      "desktop:/active.md"
    );
  });
});
