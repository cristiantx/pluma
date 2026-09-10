import { describe, expect, it } from "vitest";
import { deduplicateFileCandidates } from "../src/quickAccess/fileCandidates.js";
import {
  collectFileResults,
  matchFileCandidate,
  prepareFileCandidates,
  prepareFileQuery,
  searchFiles
} from "../src/quickAccess/fileRanking.js";
import type { FileCandidate } from "../src/quickAccess/searchTypes.js";

function file(
  name: string,
  relativePath = name,
  overrides: Partial<FileCandidate> = {}
): FileCandidate {
  return {
    id: relativePath,
    name,
    relativePath,
    path: `/workspace/${relativePath}`,
    documentId: null,
    recency: null,
    ...overrides
  };
}

const ids = (files: FileCandidate[], query: string) =>
  searchFiles(files, query).results.map(({ candidate }) => candidate.id);

describe("quick access file search", () => {
  it("keeps exact multiword filenames above recently open prefix matches", () => {
    expect(
      ids(
        [
          file("foo bar extra", undefined, {
            documentId: "open",
            recency: 100
          }),
          file("foo bar", "long/directory/foo bar")
        ],
        "foo bar"
      )
    ).toEqual(["long/directory/foo bar", "foo bar extra"]);
  });
  it("keeps every basename tier ahead of path matches and recency", () => {
    const candidates = [
      file("other.md", "read/other.md", { documentId: "open", recency: 100 }),
      file("r_e_a_d.md"),
      file("xread.md"),
      file("readme.md"),
      file("read")
    ];
    expect(ids(candidates, "read")).toEqual([
      "read",
      "readme.md",
      "xread.md",
      "r_e_a_d.md",
      "read/other.md"
    ]);
  });

  it("requires every token and highlights tokens across filename and parent path", () => {
    const result = searchFiles(
      [file("notes.md", "project/notes.md"), file("notes.md")],
      "project notes"
    );
    expect(result.total).toBe(1);
    expect(result.results[0]?.nameMatches).toEqual([{ start: 0, end: 5 }]);
    expect(result.results[0]?.pathMatches).toEqual([{ start: 0, end: 7 }]);
    expect(searchFiles([file("notes.md")], "notes missing").total).toBe(0);
  });

  it("prioritizes path queries and normalizes separators only for matching", () => {
    const candidates = [
      file("notes.md", "src/notes.md"),
      file("src-notes.md", "else/src-notes.md")
    ];
    expect(ids(candidates, "src\\notes")).toEqual(["src/notes.md"]);
    expect(
      searchFiles(candidates, "src/notes").results[0]?.pathMatches
    ).toEqual([{ start: 0, end: 9 }]);
  });

  it("preserves combining graphemes, surrogate pairs and emoji sequences in ranges", () => {
    expect(
      searchFiles([file("Cafe\u0301.md")], "CAFÉ").results[0]?.nameMatches
    ).toEqual([{ start: 0, end: 5 }]);
    expect(
      searchFiles([file("a👩‍💻b.md")], "💻").results[0]?.nameMatches
    ).toEqual([{ start: 1, end: 6 }]);
    expect(
      searchFiles([file("a😀b.md")], "😀").results[0]?.nameMatches
    ).toEqual([{ start: 1, end: 3 }]);
    expect(
      searchFiles([file("Straße.md")], "STRASSE").results[0]?.nameMatches
    ).toEqual([{ start: 0, end: 6 }]);
    expect(searchFiles([file("ΟΣ.md")], "οσ").total).toBe(1);
  });

  it("uses boundary quality and gaps before open-document boosts", () => {
    expect(
      ids(
        [file("axbyc.md", undefined, { documentId: "open" }), file("a-b-c.md")],
        "abc"
      )
    ).toEqual(["a-b-c.md", "axbyc.md"]);
  });

  it("orders empty results by open MRU, closed recents, then stable alphabetical path", () => {
    const candidates = [
      file("z"),
      file("a"),
      file("recent", undefined, { recency: 20 }),
      file("open-old", undefined, { documentId: "old", recency: 1 }),
      file("open-new", undefined, { documentId: "new", recency: 2 })
    ];
    expect(ids(candidates, "  ")).toEqual([
      "open-new",
      "open-old",
      "recent",
      "a",
      "z"
    ]);
    expect(ids(candidates.toReversed(), "")).toEqual(ids(candidates, ""));
  });

  it("merges open/workspace copies but retains case-sensitive paths and untitled identities", () => {
    const candidates = [
      file("a"),
      file("a", "a", { id: "open-a", documentId: "doc-a", recency: 5 }),
      file("A"),
      file("Untitled", "", { id: "u1", path: null, documentId: "u1" }),
      file("Untitled", "", { id: "u2", path: null, documentId: "u2" })
    ];
    const merged = deduplicateFileCandidates(candidates);
    expect(merged).toHaveLength(4);
    expect(
      merged.find((candidate) => candidate.path === "/workspace/a")?.documentId
    ).toBe("doc-a");
    expect(
      deduplicateFileCandidates(candidates.toReversed()).find(
        (candidate) => candidate.path === "/workspace/a"
      )?.id
    ).toBe("open-a");
  });

  it("caps rows at fifty while counting all matches and supports smaller limits", () => {
    const candidates = Array.from({ length: 87 }, (_, index) =>
      file(`note-${index}.md`)
    );
    expect(searchFiles(candidates, "note")).toMatchObject({
      total: 87,
      results: expect.any(Array)
    });
    expect(searchFiles(candidates, "note").results).toHaveLength(50);
    expect(searchFiles(candidates, "note", 3).results).toHaveLength(3);
    expect(searchFiles(candidates, "note", 999).results).toHaveLength(50);
    expect(searchFiles(candidates, "note", -1).results).toHaveLength(0);
  });

  it("produces identical results through independently chunkable primitives", () => {
    const candidates = [file("note.md"), file("other.md"), file("notebook.md")];
    const query = prepareFileQuery("note");
    const matches = prepareFileCandidates(candidates).flatMap((candidate) => {
      const match = matchFileCandidate(candidate, query);
      return match ? [match] : [];
    });
    expect(collectFileResults(matches)).toEqual(
      searchFiles(candidates, "note")
    );
  });
});
