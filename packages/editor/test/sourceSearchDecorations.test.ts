import { describe, expect, it, vi } from "vitest";

import { createEmptyEditorSearchQuery } from "../src/editorSearch.js";
import { updateSourceSearchMatchCache } from "../src/sourceSearchDecorations.js";

describe("updateSourceSearchMatchCache", () => {
  it("does not read document text for an empty query", () => {
    const readText = vi.fn(() => "large document");
    const cache = updateSourceSearchMatchCache(
      null,
      createEmptyEditorSearchQuery(),
      true,
      readText
    );

    expect(cache.matches).toEqual([]);
    expect(readText).not.toHaveBeenCalled();
  });

  it("reuses matches when only the selection changes", () => {
    const readText = vi.fn(() => "alpha beta alpha");
    const query = {
      ...createEmptyEditorSearchQuery(),
      search: "alpha"
    };
    const cache = updateSourceSearchMatchCache(null, query, true, readText);
    const reusedCache = updateSourceSearchMatchCache(
      cache,
      { ...query },
      false,
      readText
    );

    expect(reusedCache).toBe(cache);
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("rescans after document or query changes", () => {
    const readText = vi.fn(() => "alpha beta alpha");
    const query = {
      ...createEmptyEditorSearchQuery(),
      search: "alpha"
    };
    const cache = updateSourceSearchMatchCache(null, query, true, readText);
    const documentCache = updateSourceSearchMatchCache(
      cache,
      query,
      true,
      readText
    );
    updateSourceSearchMatchCache(
      documentCache,
      { ...query, search: "beta" },
      false,
      readText
    );

    expect(readText).toHaveBeenCalledTimes(3);
  });
});
