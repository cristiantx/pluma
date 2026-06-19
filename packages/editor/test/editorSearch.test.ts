import { describe, expect, it } from "vitest";

import {
  findCurrentSearchIndex,
  findTextMatches
} from "../src/editorSearch.js";
import type { EditorSearchQuery } from "../src/editorTypes.js";

const baseQuery: EditorSearchQuery = {
  caseSensitive: false,
  regexp: false,
  replace: "",
  search: "",
  wholeWord: false
};

describe("findTextMatches", () => {
  it("finds plain text matches case-insensitively", () => {
    expect(
      findTextMatches("Alpha alpha", { ...baseQuery, search: "alpha" }).matches
    ).toMatchObject([
      { from: 0, to: 5 },
      { from: 6, to: 11 }
    ]);
  });

  it("honors case sensitivity and whole word boundaries", () => {
    expect(
      findTextMatches("cat catalog Cat", {
        ...baseQuery,
        caseSensitive: true,
        search: "Cat",
        wholeWord: true
      }).matches
    ).toMatchObject([{ from: 12, to: 15 }]);
  });

  it("supports regex replacements", () => {
    expect(
      findTextMatches("one 12 two 34", {
        ...baseQuery,
        regexp: true,
        replace: "[$1]",
        search: "(\\d+)"
      }).matches
    ).toMatchObject([
      { from: 4, replacement: "[12]", to: 6 },
      { from: 11, replacement: "[34]", to: 13 }
    ]);
  });

  it("marks invalid regular expressions without throwing", () => {
    expect(
      findTextMatches("text", {
        ...baseQuery,
        regexp: true,
        search: "["
      })
    ).toEqual({ matches: [], valid: false });
  });
});

describe("findCurrentSearchIndex", () => {
  it("prefers the containing match and otherwise the next match", () => {
    const matches = findTextMatches("a b a", {
      ...baseQuery,
      search: "a"
    }).matches;

    expect(findCurrentSearchIndex(matches, 0)).toBe(0);
    expect(findCurrentSearchIndex(matches, 2)).toBe(1);
  });

  it("wraps to the first match after the last match", () => {
    const matches = findTextMatches("a b a", {
      ...baseQuery,
      search: "a"
    }).matches;

    expect(findCurrentSearchIndex(matches, 5)).toBe(0);
  });
});
