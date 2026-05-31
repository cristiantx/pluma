import { describe, expect, it } from "vitest";

import { isWatchedFileName } from "../../../src/main/watching/activeFileWatcher";

describe("active file watcher", () => {
  it("filters parent-directory events to the active file name", () => {
    expect(isWatchedFileName("Notes.md", "Notes.md")).toBe(true);
    expect(isWatchedFileName(Buffer.from("Notes.md"), "Notes.md")).toBe(true);
    expect(isWatchedFileName("Other.md", "Notes.md")).toBe(false);
  });

  it("treats missing event file names as relevant", () => {
    expect(isWatchedFileName(null, "Notes.md")).toBe(true);
    expect(isWatchedFileName("Notes.md", null)).toBe(true);
  });
});
