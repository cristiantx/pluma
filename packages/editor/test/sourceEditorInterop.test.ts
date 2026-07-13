import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import {
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
  it("uses the maintained editor text without stringifying the document", () => {
    const view = {
      state: {
        doc: {
          toString: () => {
            throw new Error("document should not be stringified");
          }
        },
        selection: { main: { head: 8 } }
      }
    } as unknown as EditorView;

    expect(
      getSourceCursorAnchor(view, "doc-1", "source", "# Hello world")
    ).toEqual({
      documentId: "doc-1",
      kind: "source",
      position: 8,
      visibleOffset: 6
    });
  });
});
