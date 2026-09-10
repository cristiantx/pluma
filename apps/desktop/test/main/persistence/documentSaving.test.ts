import { createDocumentSession, type DocumentSession } from "@pluma/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDocumentSaving,
  type DocumentSavingDependencies
} from "../../../src/main/documents/documentSaving";

const electron = vi.hoisted(() => ({
  showSaveDialog: vi.fn()
}));

vi.mock("electron", () => ({
  dialog: { showSaveDialog: electron.showSaveDialog }
}));

function createDesktopDocument(
  saveState: DocumentSession["saveState"] = "dirty"
): DocumentSession {
  return {
    ...createDocumentSession({
      location: { kind: "desktop-path", path: "/workspace/notes.md" },
      metadata: null,
      rawText: "# Notes"
    }),
    saveState
  };
}

function createDependencies(
  document: DocumentSession
): DocumentSavingDependencies {
  return {
    window: {} as DocumentSavingDependencies["window"],
    fileSystem: {
      writeTextAtomic: vi.fn()
    },
    enqueueDocumentSave: vi.fn((_documentId, operation) => operation()),
    clearAutosave: vi.fn(),
    getDocuments: vi.fn(() => [document]),
    getDocumentById: vi.fn(() => document),
    getActiveDocumentForActiveTab: vi.fn(() => document),
    getDefaultSaveAsPath: vi.fn(() => "/workspace/notes-copy.md"),
    saveDraftDocument: vi.fn(async () => true),
    promoteDraftDocument: vi.fn(async () => true),
    prepareTextForSave: vi.fn((candidate) => candidate.rawText),
    markSelfWritePath: vi.fn(),
    unmarkSelfWritePath: vi.fn(),
    updateState: vi.fn(),
    emitToRenderer: vi.fn(),
    persistSessionStateSoon: vi.fn(),
    emitShellSnapshot: vi.fn(),
    openFilePath: vi.fn(async () => undefined),
    refreshWorkspace: vi.fn(async () => undefined)
  };
}

describe("createDocumentSaving", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits conflict rejection without a hidden state-only mutation", async () => {
    const document = createDesktopDocument("conflict");
    const dependencies = createDependencies(document);
    const saving = createDocumentSaving(dependencies);

    await expect(
      saving.performSaveDocument(document.id, "manual")
    ).resolves.toBe(false);

    expect(dependencies.emitToRenderer).toHaveBeenCalledWith({
      type: "status",
      message: "Resolve the disk conflict before saving."
    });
    expect(dependencies.updateState).not.toHaveBeenCalled();
  });

  it("emits the original Save As error without a hidden state-only mutation", async () => {
    const document = createDesktopDocument();
    const dependencies = createDependencies(document);
    electron.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: "/workspace/notes-copy.md"
    });
    vi.mocked(dependencies.fileSystem.writeTextAtomic).mockResolvedValue({
      code: "EACCES",
      kind: "error",
      location: {
        kind: "desktop-path",
        path: "/workspace/notes-copy.md"
      },
      message: "Permission denied"
    });
    const saving = createDocumentSaving(dependencies);

    await saving.saveActiveDocumentAs();

    expect(dependencies.emitToRenderer).toHaveBeenCalledWith({
      type: "status",
      message: "Save As failed: Permission denied"
    });
    expect(dependencies.updateState).not.toHaveBeenCalled();
  });

  it("releases self-write tracking after an atomic write throws", async () => {
    vi.useFakeTimers();
    const document = createDesktopDocument();
    const dependencies = createDependencies(document);
    vi.mocked(dependencies.fileSystem.writeTextAtomic).mockRejectedValue(
      new Error("disk unavailable")
    );
    const saving = createDocumentSaving(dependencies);

    await expect(saving.saveDocument(document.id, "manual")).resolves.toBe(
      false
    );

    expect(dependencies.markSelfWritePath).toHaveBeenCalledWith(
      "/workspace/notes.md"
    );
    expect(dependencies.updateState).toHaveBeenLastCalledWith({
      documents: [expect.objectContaining({ saveState: "error" })],
      status: "Save failed: disk unavailable"
    });
    expect(dependencies.emitShellSnapshot).toHaveBeenCalledTimes(2);
    expect(dependencies.unmarkSelfWritePath).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(150);

    expect(dependencies.unmarkSelfWritePath).toHaveBeenCalledWith(
      "/workspace/notes.md"
    );
  });
});
