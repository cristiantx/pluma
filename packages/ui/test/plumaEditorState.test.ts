import { beforeEach, describe, expect, it } from "vitest";
import { createDocumentSession } from "@pluma/core";
import type { EditorCursorAnchor, EditorScrollAnchor } from "@pluma/editor";
import {
  initialPlumaStoreState,
  usePlumaStore
} from "../src/state/usePlumaStore.js";
import type { PlumaShellSnapshot } from "../src/state/plumaStoreTypes.js";

const documents = ["first", "second"].map((name) =>
  createDocumentSession({
    location: { kind: "desktop-path", path: `/tmp/${name}.md` },
    metadata: { fileId: name, mtimeMs: 0, size: 10 },
    rawText: "hello world"
  })
);
const firstId = documents[0]!.id;
const secondId = documents[1]!.id;
const cursor: EditorCursorAnchor = {
  documentId: firstId,
  kind: "source",
  position: 3,
  visibleOffset: null
};
const scroll: EditorScrollAnchor = {
  documentId: firstId,
  kind: "source",
  position: 0,
  ratio: 0.4
};

beforeEach(() => {
  usePlumaStore.setState(initialPlumaStoreState);
  for (const [index, document] of documents.entries()) {
    usePlumaStore.getState().hydrateDocumentOpened(document, index, "source");
  }
});

describe("editor snapshots", () => {
  it("retains independent documents and cursor/scroll values", () => {
    const state = usePlumaStore.getState();
    state.setEditorCursorAnchor(cursor);
    state.setEditorScrollAnchor(scroll);
    state.setEditorCursorAnchor({
      ...cursor,
      documentId: secondId,
      position: 8
    });
    const snapshots = usePlumaStore.getState().editorSnapshots;
    expect(snapshots[firstId]).toEqual({ cursor, scroll });
    expect(snapshots[secondId]?.cursor?.position).toBe(8);
    expect(snapshots[secondId]?.scroll).toBeNull();
    expect(JSON.parse(JSON.stringify(snapshots))).toEqual(snapshots);
  });

  it("copies incoming anchors and clears only the requested document", () => {
    const incoming = { ...cursor };
    const state = usePlumaStore.getState();
    state.setEditorCursorAnchor(incoming);
    incoming.position = 9;
    expect(
      usePlumaStore.getState().editorSnapshots[firstId]?.cursor?.position
    ).toBe(3);
    state.setEditorCursorAnchor({ ...cursor, documentId: secondId });
    state.clearEditorSnapshot(firstId);
    expect(usePlumaStore.getState().editorSnapshots[firstId]).toBeUndefined();
    expect(usePlumaStore.getState().editorSnapshots[secondId]).toBeDefined();
  });

  it("deep copies selection ranges and retains the main range and scroll offset", () => {
    const incoming = {
      ...cursor,
      ranges: [
        { anchor: 1, head: 4 },
        { anchor: 7, head: 9 }
      ],
      mainIndex: 1
    };
    const incomingScroll = { ...scroll, offset: 12.5 };
    const state = usePlumaStore.getState();
    state.setEditorCursorAnchor(incoming);
    state.setEditorScrollAnchor(incomingScroll);
    incoming.ranges[1]!.head = 10;
    incoming.ranges.push({ anchor: 0, head: 0 });
    incoming.mainIndex = 0;
    incomingScroll.offset = 99;
    expect(usePlumaStore.getState().editorSnapshots[firstId]).toEqual({
      cursor: {
        ...cursor,
        ranges: [
          { anchor: 1, head: 4 },
          { anchor: 7, head: 9 }
        ],
        mainIndex: 1
      },
      scroll: { ...scroll, offset: 12.5 }
    });
  });

  it("removes closed snapshots and ignores late editor callbacks", () => {
    const state = usePlumaStore.getState();
    state.setEditorCursorAnchor(cursor);
    state.hydrateDocumentClosed(firstId);
    state.setEditorCursorAnchor(cursor);
    state.setEditorScrollAnchor(scroll);
    expect(usePlumaStore.getState().editorSnapshots[firstId]).toBeUndefined();
  });

  it("increments baseline revision, clears anchors, and preserves revision through anchor updates", () => {
    const state = usePlumaStore.getState();
    state.setEditorCursorAnchor(cursor);
    state.setEditorScrollAnchor(scroll);
    state.setEditorCursorAnchor({ ...cursor, documentId: secondId });
    const secondSnapshot = usePlumaStore.getState().editorSnapshots[secondId];
    state.resetEditorBaseline(firstId);
    expect(usePlumaStore.getState().editorSnapshots[firstId]).toEqual({
      cursor: null,
      scroll: null,
      baselineRevision: 1
    });
    state.setEditorCursorAnchor(cursor);
    state.setEditorScrollAnchor(scroll);
    expect(usePlumaStore.getState().editorSnapshots[firstId]).toEqual({
      cursor,
      scroll,
      baselineRevision: 1
    });
    state.resetEditorBaseline(firstId);
    expect(usePlumaStore.getState().editorSnapshots[firstId]).toEqual({
      cursor: null,
      scroll: null,
      baselineRevision: 2
    });
    expect(usePlumaStore.getState().editorSnapshots[secondId]).toBe(
      secondSnapshot
    );
  });

  it("ignores a baseline reset after the document closes", () => {
    const state = usePlumaStore.getState();
    state.resetEditorBaseline(firstId);
    state.hydrateDocumentClosed(firstId);
    state.resetEditorBaseline(firstId);
    expect(usePlumaStore.getState().editorSnapshots[firstId]).toBeUndefined();
  });

  it("prunes absent documents on shell hydration while retaining open snapshots", () => {
    const state = usePlumaStore.getState();
    state.setEditorCursorAnchor(cursor);
    state.setEditorCursorAnchor({ ...cursor, documentId: secondId });
    const snapshot: PlumaShellSnapshot = {
      activeDocument: documents[1]!,
      activeDocumentId: secondId,
      activeTabId: secondId,
      documents: [documents[1]!],
      documentViewModes: { [secondId]: "source" },
      editorViewMode: "source",
      explorerNodes: [],
      hasWorkspace: false,
      isBridgeAvailable: true,
      isDevelopment: false,
      paneSizes: [],
      tabs: [],
      workspaceLabel: "",
      workspacePath: ""
    };
    state.hydrateShellSnapshot(snapshot);
    expect(Object.keys(usePlumaStore.getState().editorSnapshots)).toEqual([
      secondId
    ]);
    expect(
      usePlumaStore.getState().editorSnapshots[secondId]?.cursor?.position
    ).toBe(3);
  });
});
