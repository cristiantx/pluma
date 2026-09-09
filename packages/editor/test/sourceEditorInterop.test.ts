import {
  EditorSelection,
  EditorState,
  type TransactionSpec
} from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";

import {
  applySourceCursorAnchor,
  getSourceCursorAnchor,
  getSourceScrollAnchor
} from "../src/sourceEditorInterop.js";

describe("getSourceScrollAnchor", () => {
  it("keeps a ratio anchor when coordinate lookup fails", () => {
    const scrollDOM = {
      clientHeight: 100,
      getBoundingClientRect: () => ({
        height: 100,
        left: 0,
        top: 0,
        width: 100
      }),
      scrollHeight: 300,
      scrollTop: 50
    };
    const view = {
      posAtCoords: () => {
        throw new TypeError("coordinate lookup failed");
      },
      scrollDOM
    } as unknown as EditorView;

    expect(getSourceScrollAnchor(view, "doc-1", "rich")).toEqual({
      documentId: "doc-1",
      kind: "rich",
      position: null,
      ratio: 0.25
    });
  });
});

describe("getSourceCursorAnchor", () => {
  it("uses source coordinates and preserves directional multiple ranges without stringifying", () => {
    const view = {
      state: {
        doc: {
          toString: () => {
            throw new Error("document should not be stringified");
          }
        },
        selection: EditorSelection.create(
          [EditorSelection.range(8, 3), EditorSelection.range(10, 12)],
          1
        )
      }
    } as unknown as EditorView;

    expect(getSourceCursorAnchor(view, "doc-1", "source")).toEqual({
      documentId: "doc-1",
      kind: "source",
      position: 12,
      visibleOffset: null,
      ranges: [
        { anchor: 8, head: 3 },
        { anchor: 10, head: 12 }
      ],
      mainIndex: 1
    });
  });
});

describe("applySourceCursorAnchor", () => {
  it("clamps source ranges while preserving direction and the main selection without stealing focus", () => {
    const view = {
      state: EditorState.create({
        doc: "abcdefghij",
        extensions: EditorState.allowMultipleSelections.of(true)
      }),
      dispatch(spec: TransactionSpec) {
        this.state = this.state.update(spec).state;
      },
      focus: vi.fn()
    };
    applySourceCursorAnchor(view as unknown as EditorView, {
      documentId: "doc-1",
      kind: "source",
      position: 20,
      visibleOffset: null,
      ranges: [
        { anchor: 3, head: -4 },
        { anchor: 7, head: 20 }
      ],
      mainIndex: 1
    });
    expect(
      view.state.selection.ranges.map(({ anchor, head }) => ({ anchor, head }))
    ).toEqual([
      { anchor: 3, head: 0 },
      { anchor: 7, head: 10 }
    ]);
    expect(view.state.selection.mainIndex).toBe(1);
    expect(view.focus).not.toHaveBeenCalled();
  });
});
