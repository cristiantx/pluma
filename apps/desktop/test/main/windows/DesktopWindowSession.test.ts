import { describe, expect, it, vi } from "vitest";

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
  const send = vi.fn();
  const session = new DesktopWindowSession({
    appDocumentsPath: "/tmp",
    autosaveDelayMs: 1,
    draftStorage: createDraftStorage(),
    fileSystem: createFileSystem(files),
    getAutosaveEnabled: () => false,
    isDevelopment: false,
    onMenuStateChange: vi.fn(),
    onPersistSessionState: vi.fn(),
    selfWritePaths: new Set(),
    window: {
      isDestroyed: () => false,
      webContents: {
        send
      }
    } as never
  });

  return { send, session };
}

function getMetadata(filePath: string, text: string): FileMetadata {
  return {
    fileId: filePath,
    mtimeMs: text.length,
    size: text.length
  };
}

describe("DesktopWindowSession", () => {
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
});
