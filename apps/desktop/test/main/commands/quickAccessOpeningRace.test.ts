import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentSession, type DocumentSession } from "@pluma/core";
import {
  createDocumentOpening,
  type DocumentOpeningDependencies
} from "../../../src/main/documents/documentOpening";

const mocks = vi.hoisted(() => ({ createSession: vi.fn() }));
vi.mock("electron", () => ({ dialog: { showOpenDialog: vi.fn() } }));
vi.mock("../../../src/main/workspace/desktopWorkspace", () => ({
  createSessionForFilePath: mocks.createSession,
  isPathInsideDirectory: (root: string, path: string) =>
    path.startsWith(`${root}/`)
}));

const document = createDocumentSession({
  location: { kind: "desktop-path", path: "/A/note.md" },
  metadata: { fileId: "note", mtimeMs: 1, size: 7 },
  rawText: "# Note\n"
});

function fixture() {
  const dependencies: DocumentOpeningDependencies = {
    analyzeMarkdownMode: vi.fn().mockResolvedValue("none"),
    appDocumentsPath: "/documents",
    draftStorage: {} as DocumentOpeningDependencies["draftStorage"],
    emitShellSnapshot: vi.fn(),
    emitToRenderer: vi.fn(),
    fileSystem: {} as DocumentOpeningDependencies["fileSystem"],
    getCurrentMode: () => "source",
    getDefaultLineEnding: () => "lf",
    getDocumentByDesktopPath: () => null,
    getDocuments: () => [],
    getWorkspaceEntries: () => [],
    getWorkspacePath: () => "/A",
    mergeDocumentSession: vi.fn(),
    openFolderPath: vi.fn(),
    persistSessionStateSoon: vi.fn(),
    syncEditorModeForActiveDocument: vi.fn(),
    updateActiveFileWatcher: vi.fn(),
    updateShellData: vi.fn(),
    updateWorkspaceWatcher: vi.fn(),
    window: {} as DocumentOpeningDependencies["window"]
  };
  let resolve!: (document: DocumentSession) => void;
  mocks.createSession.mockReturnValue(
    new Promise<DocumentSession>((finish) => {
      resolve = finish;
    })
  );
  return {
    dependencies,
    resolve,
    opening: createDocumentOpening(dependencies)
  };
}

beforeEach(() => vi.clearAllMocks());

describe("quick access opening identity after file read", () => {
  it("does not activate or publish a file when its workspace changed during reading", async () => {
    const { dependencies, resolve, opening } = fixture();
    let current = true;
    const result = opening.openFilePath("/A/note.md", {
      workspacePath: "/A",
      isCurrent: () => current
    });
    expect(mocks.createSession).toHaveBeenCalledOnce();
    expect(dependencies.mergeDocumentSession).not.toHaveBeenCalled();
    current = false;
    dependencies.getWorkspacePath = () => "/B";
    resolve(document);
    await expect(result).resolves.toMatchObject({ status: "unavailable" });
    expect(dependencies.mergeDocumentSession).not.toHaveBeenCalled();
    expect(dependencies.updateShellData).not.toHaveBeenCalled();
    expect(dependencies.emitShellSnapshot).not.toHaveBeenCalled();
    expect(dependencies.updateWorkspaceWatcher).not.toHaveBeenCalled();
    expect(dependencies.persistSessionStateSoon).not.toHaveBeenCalled();
  });

  it("publishes and activates the file when the opening identity remains current", async () => {
    const { dependencies, resolve, opening } = fixture();
    const result = opening.openFilePath("/A/note.md", {
      workspacePath: "/A",
      isCurrent: () => true
    });
    resolve(document);
    await expect(result).resolves.toEqual({ status: "executed" });
    expect(dependencies.mergeDocumentSession).toHaveBeenCalledExactlyOnceWith(
      document
    );
    expect(dependencies.updateShellData).toHaveBeenCalledWith(
      expect.objectContaining({ workspacePath: "/A" })
    );
    expect(dependencies.emitShellSnapshot).toHaveBeenCalledOnce();
  });
});
