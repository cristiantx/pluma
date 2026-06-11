import { describe, expect, it } from "vitest";

import {
  getWorkspaceSearchSummary,
  groupWorkspaceSearchMatches
} from "../src/shell/workspaceSearchResults.js";
import type { WorkspaceSearchMatch } from "../src/state/plumaStoreTypes.js";

const matches: WorkspaceSearchMatch[] = [
  {
    filePath: "/tmp/pluma/one.md",
    line: 1,
    lineText: "already here",
    matchEnd: 7,
    matchStart: 0,
    preview: "already here"
  },
  {
    filePath: "/tmp/pluma/one.md",
    line: 3,
    lineText: "also already",
    matchEnd: 12,
    matchStart: 5,
    preview: "also already"
  },
  {
    filePath: "/tmp/pluma/two.md",
    line: 2,
    lineText: "already again",
    matchEnd: 7,
    matchStart: 0,
    preview: "already again"
  }
];

describe("groupWorkspaceSearchMatches", () => {
  it("groups matches by relative file label", () => {
    expect(groupWorkspaceSearchMatches(matches, "/tmp/pluma")).toEqual([
      {
        filePath: "/tmp/pluma/one.md",
        label: "one.md",
        matches: [matches[0], matches[1]]
      },
      {
        filePath: "/tmp/pluma/two.md",
        label: "two.md",
        matches: [matches[2]]
      }
    ]);
  });
});

describe("getWorkspaceSearchSummary", () => {
  it("counts matches and files", () => {
    expect(getWorkspaceSearchSummary(matches)).toBe("3 matches in 2 files");
    expect(getWorkspaceSearchSummary([matches[0]])).toBe("1 match in 1 file");
  });
});
