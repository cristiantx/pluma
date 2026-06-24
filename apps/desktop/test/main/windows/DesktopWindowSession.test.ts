import { describe, expect, it, vi } from "vitest";

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
  FileMetadata,
  FileSystemAdapter
} from "@pluma/core";

import { DesktopWindowSession } from "../../../src/main/windows/DesktopWindowSession";
import type { AppDraftStorage } from "../../../src/main/persistence/appDraftStorage";

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

function createSession(files: Record<string, string>) {
  const onMenuStateChange = vi.fn();
  const send = vi.fn();
  const session = new DesktopWindowSession({
    appDocumentsPath: "/tmp",
    autosaveDelayMs: 1,
    draftStorage: createDraftStorage(),
    fileSystem: createFileSystem(files),
    getAutosaveEnabled: () => false,
    getDefaultLineEnding: () => "lf",
    getOpenExportedFile: () => false,
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

describe("DesktopWindowSession", () => {
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
          editorMode: "source",
          kind: "desktop-path",
          path: "/workspace/source.md"
        }
      ],
      editorMode: "source",
      paneSizes: [],
      workspacePath: "/workspace"
    });

    expect(session.getPersistedState().editorMode).toBe("rich");

    session.setActiveDocument("desktop:/workspace/source.md");

    expect(session.getPersistedState().editorMode).toBe("source");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "source",
      type: "mode-changed"
    });

    session.setActiveDocument("desktop:/workspace/rich.md");

    expect(session.getPersistedState().editorMode).toBe("rich");
    expect(send).toHaveBeenCalledWith("pluma:event", {
      mode: "rich",
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
      editorMode: "rich",
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

    session.setActiveDocument("desktop:/workspace/source-only.md");

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

    session.setActiveTab("settings");

    expect(session.hasActiveDocument()).toBe(false);
    expect(session.getPersistedState().activeDocumentPath).toBe(
      "/workspace/notes.md"
    );
    expect(onMenuStateChange).toHaveBeenCalled();
  });
});
