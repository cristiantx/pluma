import { beforeEach, describe, expect, it } from "vitest";
import { createDocumentSession } from "@pluma/core";
import type { PlumaTab } from "../src/adapters/tabModel.js";
import {
  initialPlumaStoreState,
  usePlumaStore
} from "../src/state/usePlumaStore.js";
import { buildQuickAccessCandidates } from "../src/shell/quickaccess/quickAccessCandidates.js";
import {
  quickAccessContext,
  quickAccessInvocationContext
} from "../src/shell/quickaccess/quickAccessContext.js";

beforeEach(() => {
  usePlumaStore.setState({
    ...usePlumaStore.getState(),
    ...initialPlumaStoreState
  });
});

describe("quick access opening state", () => {
  it("preserves each mode's query, selection and history within one opening", () => {
    const { openQuickAccess, updateQuickAccess } = usePlumaStore.getState();
    openQuickAccess("files");
    const openingId = usePlumaStore.getState().quickAccess.openingId;
    updateQuickAccess({
      queries: { files: "notes", commands: "save" },
      selections: { files: "file-1", commands: "save-file" },
      history: { "file-1": 10 }
    });
    openQuickAccess("commands");
    openQuickAccess("files");
    expect(usePlumaStore.getState().quickAccess).toMatchObject({
      openingId,
      mode: "files",
      queries: { files: "notes", commands: "save" },
      selections: { files: "file-1", commands: "save-file" },
      history: { "file-1": 10 }
    });
  });

  it("starts a fresh session after closing, retaining MRU and invalidating requests", () => {
    const { openQuickAccess, closeQuickAccess, updateQuickAccess } =
      usePlumaStore.getState();
    openQuickAccess("files");
    updateQuickAccess({
      queries: { files: "old", commands: "save" },
      selections: { files: "old", commands: "save" },
      history: { old: 4 },
      busy: true
    });
    const before = usePlumaStore.getState().quickAccess;
    closeQuickAccess();
    const closed = usePlumaStore.getState().quickAccess;
    expect(closed.mode).toBeNull();
    expect(closed.busy).toBe(false);
    expect(closed.requestId).toBeGreaterThan(before.requestId);
    openQuickAccess("commands");
    expect(usePlumaStore.getState().quickAccess).toMatchObject({
      openingId: before.openingId + 1,
      queries: { files: "", commands: "" },
      selections: { files: null, commands: null },
      history: { old: 4 }
    });
    expect(usePlumaStore.getState().quickAccess.requestId).toBeGreaterThan(
      closed.requestId
    );
  });

  it("refocuses a repeated shortcut without toggling or changing opening identity", () => {
    const { openQuickAccess } = usePlumaStore.getState();
    openQuickAccess("files");
    const first = usePlumaStore.getState().quickAccess;
    openQuickAccess("files");
    expect(usePlumaStore.getState().quickAccess).toMatchObject({
      mode: "files",
      openingId: first.openingId,
      focusRequestId: first.focusRequestId + 1
    });
  });
});

describe("quick access candidate identities", () => {
  it("merges indexed open documents and preserves outside and unsaved documents", () => {
    const tabs: PlumaTab[] = [
      {
        kind: "document",
        id: "inside",
        title: "note.md",
        location: { kind: "desktop-path", path: "/work/docs/note.md" }
      },
      {
        kind: "document",
        id: "outside",
        title: "note.md",
        location: { kind: "desktop-path", path: "/elsewhere/note.md" }
      },
      {
        kind: "document",
        id: "draft-one",
        title: "Untitled",
        location: { kind: "app-draft", draftId: "draft-one", name: "Untitled" }
      },
      {
        kind: "document",
        id: "draft-two",
        title: "Untitled",
        location: { kind: "app-draft", draftId: "draft-two", name: "Untitled" }
      },
      { kind: "settings", id: "settings", title: "Settings" }
    ];
    const result = buildQuickAccessCandidates(
      tabs,
      [
        { id: "/work/docs", kind: "folder", depth: 0, label: "docs" },
        { id: "/work/docs/note.md", kind: "file", depth: 1, label: "note.md" }
      ],
      "/work",
      { inside: 8 }
    );
    expect(result).toHaveLength(4);
    expect(result.find((entry) => entry.id === "inside")).toMatchObject({
      documentId: "inside",
      path: "/work/docs/note.md",
      relativePath: "docs/note.md",
      recency: 8
    });
    expect(result.find((entry) => entry.id === "outside")?.relativePath).toBe(
      "/elsewhere/note.md"
    );
    expect(
      result
        .filter((entry) => entry.path === null)
        .map((entry) => ({ id: entry.id, relativePath: entry.relativePath }))
    ).toEqual([
      { id: "draft-one", relativePath: "Unsaved document" },
      { id: "draft-two", relativePath: "Unsaved document" }
    ]);
  });
});

function setActiveDocument(
  saveState: "idle" | "conflict" | "external-change" = "idle"
) {
  const document = {
    ...createDocumentSession({
      location: { kind: "desktop-path", path: "/work/note.md" },
      metadata: { fileId: "1", mtimeMs: 0, size: 6 },
      rawText: "# Note"
    }),
    saveState
  };
  usePlumaStore.setState((state) => ({
    document: { documents: [document], activeDocument: document },
    tabs: { ...state.tabs, activeTabId: document.id }
  }));
  return document;
}

describe("quick access command context", () => {
  it("allows Settings to close but excludes the retained document from commands", () => {
    setActiveDocument();
    usePlumaStore.setState((state) => ({
      tabs: { ...state.tabs, activeTabId: "settings" }
    }));
    expect(quickAccessContext(usePlumaStore.getState())).toMatchObject({
      hasActiveDocument: false,
      canCloseActiveTab: true,
      canEditDocument: false,
      canReloadDocument: false
    });
    expect(
      quickAccessInvocationContext(usePlumaStore.getState())
    ).toMatchObject({ activeTabId: "settings", documentId: null });
  });

  it("disables formatting in Preview while retaining document and reload context", () => {
    const document = setActiveDocument();
    usePlumaStore.setState((state) => ({
      layout: { ...state.layout, editorViewMode: "preview" }
    }));
    expect(quickAccessContext(usePlumaStore.getState())).toMatchObject({
      hasActiveDocument: true,
      canEditDocument: false,
      canReloadDocument: true,
      canKeepEditing: false
    });
    expect(
      quickAccessInvocationContext(usePlumaStore.getState()).documentId
    ).toBe(document.id);
  });

  it.each(["conflict", "external-change"] as const)(
    "allows Keep Editing for %s",
    (saveState) => {
      setActiveDocument(saveState);
      expect(quickAccessContext(usePlumaStore.getState()).canKeepEditing).toBe(
        true
      );
    }
  );
});
