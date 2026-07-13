import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { dialog } from "electron";

import type {
  DesktopFileLocation,
  DocumentSession,
  FileMetadata,
  FileSystemAdapter
} from "@pluma/core";

import { DesktopWindowSession } from "../../../src/main/windows/DesktopWindowSession";
import type { AppDraftStorage } from "../../../src/main/persistence/appDraftStorage";
import type { DesktopShellSnapshot } from "../../../src/shared/shellState";

function createFileSystem(
  files: Record<string, string>
): FileSystemAdapter<DesktopFileLocation> {
  return {
    async getMetadata(location) {
      const text = files[location.path];

      if (text === undefined) {
        return null;
      }

      return getMetadata(location.path, text);
    },
    async listDirectory(location) {
      return Object.keys(files)
        .filter((filePath) => filePath.startsWith(`${location.path}/`))
        .map((filePath) => ({
          kind: "file" as const,
          location: {
            kind: "desktop-path" as const,
            path: filePath
          },
          name: filePath.split("/").at(-1) ?? filePath
        }));
    },
    async readText(location) {
      const text = files[location.path];

      if (text === undefined) {
        throw new Error(`Missing fixture file: ${location.path}`);
      }

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

function createDraftStorage(): AppDraftStorage {
  return {
    createDraft: vi.fn(),
    deleteDraft: vi.fn(),
    readDraft: vi.fn(async () => null),
    writeDraft: vi.fn()
  };
}

function createSession(
  files: Record<string, string>,
  options: {
    autosaveDelayMs?: number;
    autosaveEnabled?: boolean;
    draftStorage?: AppDraftStorage;
  } = {}
) {
  const onMenuStateChange = vi.fn();
  const send = vi.fn();
  const session = new DesktopWindowSession({
    appDocumentsPath: "/tmp",
    autosaveDelayMs: options.autosaveDelayMs ?? 1,
    draftStorage: options.draftStorage ?? createDraftStorage(),
    fileSystem: createFileSystem(files),
    getAutosaveEnabled: () => options.autosaveEnabled ?? false,
    getDefaultLineEnding: () => "lf",
    getOpenExportedFile: () => false,
    getWorkspaceRespectGitIgnore: () => false,
    getWorkspaceShowHiddenFiles: () => true,
    isDevelopment: false,
    onMenuStateChange,
    onPersistSessionState: vi.fn(),
    selfWritePaths: new Set(),
    window: {
      isDestroyed: () => false,
      webContents: {
        send
      }
    } as never
  });

  return { onMenuStateChange, send, session };
}

function getMetadata(filePath: string, text: string): FileMetadata {
  return {
    fileId: filePath,
    mtimeMs: text.length,
    size: text.length
  };
}

function getLastShellSnapshot(
  send: ReturnType<typeof vi.fn>
): DesktopShellSnapshot {
  const shellSnapshotCall = [...send.mock.calls]
    .reverse()
    .find(([channel, event]) => {
      return (
        channel === "pluma:event" &&
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "shell-snapshot"
      );
    });

  if (!shellSnapshotCall) {
    throw new Error("Expected a shell snapshot event.");
  }

  return shellSnapshotCall[1].snapshot;
}

function updateSessionShellData(
  session: DesktopWindowSession,
  update: Partial<DesktopShellSnapshot>
): void {
  (
    session as unknown as {
      updateShellData(update: Partial<DesktopShellSnapshot>): void;
    }
  ).updateShellData(update);
}

function getSessionShellData(
  session: DesktopWindowSession
): DesktopShellSnapshot {
  return (session as unknown as { shellData: DesktopShellSnapshot }).shellData;
}

describe("DesktopWindowSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores and switches editor mode per document", async () => {
    const { send, session } = createSession({
      "/workspace/rich.md": "# Rich\n",
      "/workspace/source.md": "# Source\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/rich.md",
      activeDocumentRef: {
        editorMode: "rich",
        kind: "desktop-path",
        path: "/workspace/rich.md"
      },
      documentPaths: [],
      documentRefs: [
        {
          editorMode: "rich",
          kind: "desktop-path",
          path: "/workspace/rich.md"
        },
        {
          editorMode: "preview",
          kind: "desktop-path",
          path: "/workspace/source.md"
        }
      ],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    expect(session.getPersistedState().editorMode).toBe("rich");

    await session.setActiveDocument("desktop:/workspace/source.md");

    expect(session.getPersistedState().editorMode).toBe("preview");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "preview",
      type: "mode-changed"
    });

    await session.setActiveDocument("desktop:/workspace/rich.md");

    expect(session.getPersistedState().editorMode).toBe("rich");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "rich",
      type: "mode-changed"
    });
  });

  it("cycles editor mode from source to rich to preview to source", async () => {
    const { send, session } = createSession({
      "/workspace/notes.md": "# Notes\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    await session.handleCommand("toggle-mode");
    expect(session.getPersistedState().editorMode).toBe("rich");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "rich",
      type: "mode-changed"
    });

    await session.handleCommand("toggle-mode");
    expect(session.getPersistedState().editorMode).toBe("preview");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "preview",
      type: "mode-changed"
    });

    await session.handleCommand("toggle-mode");
    expect(session.getPersistedState().editorMode).toBe("source");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "source",
      type: "mode-changed"
    });
  });

  it("clamps restored source-only documents to source mode", async () => {
    const { session } = createSession({
      "/workspace/source-only.md": "<aside>Keep exact</aside>\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/source-only.md",
      documentPaths: ["/workspace/source-only.md"],
      editorMode: "preview",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    expect(session.getPersistedState().editorMode).toBe("source");
  });

  it("clamps tab switches to source mode for source-only documents", async () => {
    const { send, session } = createSession({
      "/workspace/rich.md": "# Rich\n",
      "/workspace/source-only.md": "<aside>Keep exact</aside>\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/rich.md",
      documentPaths: ["/workspace/rich.md", "/workspace/source-only.md"],
      editorMode: "rich",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    await session.setActiveDocument("desktop:/workspace/source-only.md");

    expect(session.getPersistedState().editorMode).toBe("source");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "source",
      type: "mode-changed"
    });
  });

  it("forces source-only documents to source when setting or toggling mode", async () => {
    const { send, session } = createSession({
      "/workspace/source-only.md": "<aside>Keep exact</aside>\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/source-only.md",
      documentPaths: ["/workspace/source-only.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    session.setEditorMode("preview");

    expect(session.getPersistedState().editorMode).toBe("source");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "source",
      type: "mode-changed"
    });

    await session.handleCommand("toggle-mode");

    expect(session.getPersistedState().editorMode).toBe("source");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "source",
      type: "mode-changed"
    });
  });

  it("saves dirty documents before allowing window close", async () => {
    const files = {
      "/workspace/notes.md": "# Saved\n"
    };
    const { session } = createSession(files);
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 0
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "rich",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText("desktop:/workspace/notes.md", "# Edited\n");

    await expect(session.closeWindowWithProtection()).resolves.toBe(true);
    expect(files["/workspace/notes.md"]).toBe("# Edited\n");
  });

  it("updates edited document state without echoing a full shell snapshot", async () => {
    const { send, session } = createSession({
      "/workspace/notes.md": "# Saved\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    send.mockClear();
    session.updateDocumentText("desktop:/workspace/notes.md", "# Edited\n");

    expect(send).not.toHaveBeenCalled();
    expect(session.getProtectedDocuments()).toEqual([
      expect.objectContaining({
        rawText: "# Edited\n",
        saveState: "dirty"
      })
    ]);
  });

  it("allows window close without saving when requested", async () => {
    const files = {
      "/workspace/notes.md": "# Saved\n"
    };
    const { session } = createSession(files);
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 1
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "rich",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText("desktop:/workspace/notes.md", "# Edited\n");

    await expect(session.closeWindowWithProtection()).resolves.toBe(true);
    expect(files["/workspace/notes.md"]).toBe("# Saved\n");
  });

  it("cancels window close when requested", async () => {
    const { session } = createSession({
      "/workspace/notes.md": "# Saved\n"
    });
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 2
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "rich",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText("desktop:/workspace/notes.md", "# Edited\n");

    await expect(session.closeWindowWithProtection()).resolves.toBe(false);
  });

  it("ignores workspace file opens outside the active workspace", async () => {
    const { session } = createSession({
      "/outside/notes.md": "# Outside\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: null,
      documentPaths: [],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    await session.openWorkspaceFile("/outside/notes.md");

    expect(session.getPersistedState().documentPaths).toEqual([]);
  });

  it("reloads a clean inactive document from disk when its tab is activated", async () => {
    const files = {
      "/workspace/active.md": "# Active\n",
      "/workspace/inactive.md": "# Old\n"
    };
    const { send, session } = createSession(files);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/active.md",
      documentPaths: ["/workspace/active.md", "/workspace/inactive.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    send.mockClear();
    files["/workspace/inactive.md"] = "# Updated inactive file\n";

    await session.setActiveDocument("desktop:/workspace/inactive.md");

    const snapshot = getLastShellSnapshot(send);
    expect(snapshot.activeDocumentId).toBe("desktop:/workspace/inactive.md");
    expect(snapshot.status).toBe("Active file reloaded from disk.");
    expect(
      snapshot.documents.find(
        (document) => document.id === "desktop:/workspace/inactive.md"
      )
    ).toEqual(
      expect.objectContaining({
        lastSavedText: "# Updated inactive file\n",
        rawText: "# Updated inactive file\n",
        saveState: "idle"
      })
    );
  });

  it("keeps dirty inactive edits when disk changes before tab activation", async () => {
    const files = {
      "/workspace/active.md": "# Active\n",
      "/workspace/inactive.md": "# Old\n"
    };
    const { send, session } = createSession(files);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/active.md",
      documentPaths: ["/workspace/active.md", "/workspace/inactive.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText(
      "desktop:/workspace/inactive.md",
      "# Local inactive edits\n"
    );

    send.mockClear();
    files["/workspace/inactive.md"] = "# Remote inactive change\n";

    await session.setActiveDocument("desktop:/workspace/inactive.md");

    const snapshot = getLastShellSnapshot(send);
    expect(snapshot.activeDocumentId).toBe("desktop:/workspace/inactive.md");
    expect(snapshot.status).toBe("Active file changed on disk.");
    expect(
      snapshot.documents.find(
        (document) => document.id === "desktop:/workspace/inactive.md"
      )
    ).toEqual(
      expect.objectContaining({
        lastSavedText: "# Old\n",
        rawText: "# Local inactive edits\n",
        saveState: "conflict"
      })
    );
  });

  it("reloads a conflicted document with the conflict-specific prompt", async () => {
    const files = {
      "/workspace/active.md": "# Active\n",
      "/workspace/conflict.md": "# Saved\n"
    };
    const { send, session } = createSession(files);
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 0
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/active.md",
      documentPaths: ["/workspace/active.md", "/workspace/conflict.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText(
      "desktop:/workspace/conflict.md",
      "# Local edits\n"
    );
    files["/workspace/conflict.md"] = "# Disk change\n";

    await session.setActiveDocument("desktop:/workspace/conflict.md");
    send.mockClear();

    await session.handleCommand("reload-from-disk");

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        buttons: ["Reload from Disk", "Keep Editing"],
        cancelId: 1,
        defaultId: 1,
        detail:
          "This file has local edits and also changed on disk. Reloading will discard your local edits and replace the editor contents with the disk version.",
        message: "Reload file from disk?",
        type: "warning"
      })
    );
    expect(dialog.showMessageBox).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        buttons: ["Save", "Don't Save", "Cancel"]
      })
    );

    const snapshot = getLastShellSnapshot(send);
    expect(snapshot.status).toBe("Reloaded conflict.md from disk.");
    expect(
      snapshot.documents.find(
        (document) => document.id === "desktop:/workspace/conflict.md"
      )
    ).toEqual(
      expect.objectContaining({
        lastSavedText: "# Disk change\n",
        rawText: "# Disk change\n",
        saveState: "idle"
      })
    );
  });

  it("keeps local edits when conflicted reload is cancelled", async () => {
    const files = {
      "/workspace/active.md": "# Active\n",
      "/workspace/conflict.md": "# Saved\n"
    };
    const { send, session } = createSession(files);
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 1
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/active.md",
      documentPaths: ["/workspace/active.md", "/workspace/conflict.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText(
      "desktop:/workspace/conflict.md",
      "# Local edits\n"
    );
    files["/workspace/conflict.md"] = "# Disk change\n";

    await session.setActiveDocument("desktop:/workspace/conflict.md");
    send.mockClear();

    await session.handleCommand("reload-from-disk");

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        buttons: ["Reload from Disk", "Keep Editing"]
      })
    );
    expect(send).toHaveBeenCalledWith("pluma:event", {
      message: "Reload cancelled.",
      type: "status"
    });
    expect(
      session
        .getProtectedDocuments()
        .find((document) => document.id === "desktop:/workspace/conflict.md")
    ).toEqual(
      expect.objectContaining({
        rawText: "# Local edits\n",
        saveState: "conflict"
      })
    );
  });

  it("reloads an external-change document without prompting", async () => {
    const files = {
      "/workspace/changed.md": "# Saved\n"
    };
    const { send, session } = createSession(files);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/changed.md",
      documentPaths: ["/workspace/changed.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    const snapshotBeforeExternalChange = getSessionShellData(session);
    const externalChangeDocuments = snapshotBeforeExternalChange.documents.map(
      (document) =>
        document.id === "desktop:/workspace/changed.md"
          ? ({
              ...document,
              saveState: "external-change"
            } satisfies DocumentSession)
          : document
    );

    files["/workspace/changed.md"] = "# Disk change\n";
    updateSessionShellData(session, { documents: externalChangeDocuments });

    send.mockClear();

    await session.handleCommand("reload-from-disk");

    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    const snapshot = getLastShellSnapshot(send);
    expect(snapshot.status).toBe("Reloaded changed.md from disk.");
    expect(
      snapshot.documents.find(
        (document) => document.id === "desktop:/workspace/changed.md"
      )
    ).toEqual(
      expect.objectContaining({
        rawText: "# Disk change\n",
        saveState: "idle"
      })
    );
  });

  it("keeps the generic unsaved-changes prompt for dirty reloads", async () => {
    const files = {
      "/workspace/notes.md": "# Saved\n"
    };
    const { session } = createSession(files);
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 2
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText("desktop:/workspace/notes.md", "# Dirty\n");

    await session.handleCommand("reload-from-disk");

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        buttons: ["Save", "Don't Save", "Cancel"],
        message: "Reload with unsaved changes?"
      })
    );
  });

  it("marks an inactive document as conflicted when it is deleted before activation", async () => {
    const files: Record<string, string> = {
      "/workspace/active.md": "# Active\n",
      "/workspace/inactive.md": "# Old\n"
    };
    const { send, session } = createSession(files);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/active.md",
      documentPaths: ["/workspace/active.md", "/workspace/inactive.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    send.mockClear();
    delete files["/workspace/inactive.md"];

    await session.setActiveDocument("desktop:/workspace/inactive.md");

    const snapshot = getLastShellSnapshot(send);
    expect(snapshot.activeDocumentId).toBe("desktop:/workspace/inactive.md");
    expect(snapshot.status).toBe("Active file was deleted on disk.");
    expect(
      snapshot.documents.find(
        (document) => document.id === "desktop:/workspace/inactive.md"
      )
    ).toEqual(
      expect.objectContaining({
        rawText: "# Old\n",
        saveState: "conflict"
      })
    );
  });

  it("switches to an unchanged inactive document without reload status churn", async () => {
    const { send, session } = createSession({
      "/workspace/active.md": "# Active\n",
      "/workspace/inactive.md": "# Old\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/active.md",
      documentPaths: ["/workspace/active.md", "/workspace/inactive.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    send.mockClear();

    await session.setActiveDocument("desktop:/workspace/inactive.md");

    const snapshot = getLastShellSnapshot(send);
    expect(snapshot.activeDocumentId).toBe("desktop:/workspace/inactive.md");
    expect(snapshot.status).toBe("Restored previous session.");
    expect(
      snapshot.documents.find(
        (document) => document.id === "desktop:/workspace/inactive.md"
      )
    ).toEqual(
      expect.objectContaining({
        rawText: "# Old\n",
        saveState: "idle"
      })
    );
  });

  it("converts active document line endings and marks it dirty", async () => {
    const { send, session } = createSession({
      "/workspace/notes.md": "# Notes\nBody\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    session.convertActiveDocumentLineEndings("crlf");

    expect(send).toHaveBeenLastCalledWith(
      "pluma:event",
      expect.objectContaining({
        snapshot: expect.objectContaining({
          documents: [
            expect.objectContaining({
              lineEnding: "crlf",
              rawText: "# Notes\r\nBody\r\n",
              saveState: "dirty"
            })
          ]
        }),
        type: "shell-snapshot"
      })
    );
  });

  it("does not treat the remembered document as active when settings is selected", async () => {
    const { onMenuStateChange, session } = createSession({
      "/workspace/notes.md": "# Notes\n"
    });

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    expect(session.hasActiveDocument()).toBe(true);

    await session.setActiveTab("settings");

    expect(session.hasActiveDocument()).toBe(false);
    expect(session.getPersistedState().activeDocumentPath).toBe(
      "/workspace/notes.md"
    );
    expect(onMenuStateChange).toHaveBeenCalled();
  });

  it("keeps the current workspace when protected documents cancel a folder switch", async () => {
    const files = {
      "/workspace/notes.md": "# Saved\n",
      "/next/readme.md": "# Next\n"
    };
    const { session } = createSession(files);
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/next"]
    });
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 2
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText("desktop:/workspace/notes.md", "# Dirty\n");

    await session.handleCommand("open-folder");

    expect(session.getPersistedState()).toMatchObject({
      documentPaths: ["/workspace/notes.md"],
      workspacePath: "/workspace"
    });
  });

  it("closes documents after discarding changes during a folder switch", async () => {
    const files = {
      "/workspace/notes.md": "# Saved\n",
      "/next/readme.md": "# Next\n"
    };
    const { session } = createSession(files);
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/next"]
    });
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 1
    } as Electron.MessageBoxReturnValue);

    await session.restorePersistedState({
      activeDocumentPath: "/workspace/notes.md",
      documentPaths: ["/workspace/notes.md"],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });
    session.updateDocumentText("desktop:/workspace/notes.md", "# Dirty\n");

    await session.handleCommand("open-folder");

    expect(session.getPersistedState()).toMatchObject({
      documentPaths: [],
      workspacePath: "/next"
    });
    expect(files["/workspace/notes.md"]).toBe("# Saved\n");
  });

  it("keeps edits dirty until the matching draft autosave reaches storage", async () => {
    let resolveFirstWrite: ((metadata: FileMetadata) => void) | null = null;
    let resolveSecondWrite: ((metadata: FileMetadata) => void) | null = null;
    const writeDraft = vi
      .fn<AppDraftStorage["writeDraft"]>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstWrite = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondWrite = resolve;
          })
      );
    const draftStorage: AppDraftStorage = {
      createDraft: vi.fn(),
      deleteDraft: vi.fn(),
      readDraft: vi.fn(async () => "# Saved draft\n"),
      writeDraft
    };
    const { session } = createSession({}, { draftStorage });

    await session.restorePersistedState({
      activeDocumentPath: null,
      activeDocumentRef: {
        draftId: "draft-1",
        kind: "app-draft",
        name: "Untitled-1"
      },
      documentPaths: [],
      documentRefs: [
        {
          draftId: "draft-1",
          kind: "app-draft",
          name: "Untitled-1"
        }
      ],
      editorMode: "source",
      workspacePath: null
    });

    session.updateDocumentText("draft:draft-1", "# First edit\n");
    await vi.waitFor(() => expect(writeDraft).toHaveBeenCalledTimes(1));
    session.updateDocumentText("draft:draft-1", "# Second edit\n");
    await vi.waitFor(() => expect(resolveFirstWrite).not.toBeNull());
    resolveFirstWrite?.({ fileId: "draft", mtimeMs: 1, size: 13 });

    await vi.waitFor(() => expect(writeDraft).toHaveBeenCalledTimes(2));
    expect(session.getProtectedDocuments()).toEqual([
      expect.objectContaining({
        rawText: "# Second edit\n",
        saveState: "dirty"
      })
    ]);

    resolveSecondWrite?.({ fileId: "draft", mtimeMs: 2, size: 14 });
    await vi.waitFor(() =>
      expect(getSessionShellData(session).documents[0]).toMatchObject({
        rawText: "# Second edit\n",
        saveState: "idle"
      })
    );
    expect(writeDraft.mock.calls.map(([, rawText]) => rawText)).toEqual([
      "# First edit\n",
      "# Second edit\n"
    ]);
  });
});
