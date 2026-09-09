import { EditorState } from "@codemirror/state";
import { describe, expect, it, vi } from "vitest";

import { getSourceSearchResults } from "../src/sourceSearchResults.js";
import type { EditorSearchQuery } from "../src/editorTypes.js";

const query: EditorSearchQuery = {
  search: "hello",
  replace: "",
  caseSensitive: false,
  wholeWord: false,
  regexp: false
};

describe("source search results cache", () => {
  it("does not stringify the document for an empty query", () => {
    const state = EditorState.create({ doc: "hello" });
    const stringify = vi.spyOn(state.doc, "toString").mockImplementation(() => {
      throw new Error("empty queries should not read document text");
    });
    expect(getSourceSearchResults(state.doc, { ...query, search: "" })).toEqual(
      { matches: [], valid: true }
    );
    expect(stringify).not.toHaveBeenCalled();
  });

  it("reuses matches after selection movement and equivalent query objects", () => {
    const state = EditorState.create({ doc: "hello hello" });
    const stringify = vi.spyOn(state.doc, "toString");
    const results = getSourceSearchResults(state.doc, query);
    const moved = state.update({ selection: { anchor: 8 } }).state;
    expect(getSourceSearchResults(moved.doc, { ...query })).toBe(results);
    expect(results.matches).toHaveLength(2);
    expect(stringify).toHaveBeenCalledTimes(1);
  });

  it("recomputes after document edits and search option changes", () => {
    const state = EditorState.create({ doc: "hello HELLO" });
    const first = getSourceSearchResults(state.doc, query);
    const caseSensitive = getSourceSearchResults(state.doc, {
      ...query,
      caseSensitive: true
    });
    expect(caseSensitive).not.toBe(first);
    expect(caseSensitive.matches).toHaveLength(1);
    const changed = state.update({
      changes: { from: state.doc.length, insert: " hello" }
    }).state;
    const next = getSourceSearchResults(changed.doc, query);
    expect(next).not.toBe(first);
    expect(next.matches).toHaveLength(3);
    const differentQuery = getSourceSearchResults(changed.doc, {
      ...query,
      search: "missing"
    });
    expect(differentQuery.matches).toEqual([]);
  });
});
