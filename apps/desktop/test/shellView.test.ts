import { describe, expect, it } from "vitest";

import { initialShellState } from "../src/shellState";
import {
  extractLeafName,
  getExplorerNodes,
  getStatusMetrics,
  getWorkspaceLabel
} from "../src/shellView";

describe("extractLeafName", () => {
  it("returns the last path segment for unix and windows paths", () => {
    expect(extractLeafName("/tmp/pluma/notes.md")).toBe("notes.md");
    expect(extractLeafName("C:\\Users\\me\\drafts")).toBe("drafts");
  });
});

describe("getWorkspaceLabel", () => {
  it("prefers the active folder over the active file", () => {
    expect(
      getWorkspaceLabel({
        ...initialShellState,
        activeFolder: "/tmp/pluma",
        activeFile: "/tmp/pluma/notes.md"
      })
    ).toBe("pluma");
  });
});

describe("getStatusMetrics", () => {
  it("returns placeholder metrics when no file is active", () => {
    expect(getStatusMetrics(initialShellState)).toEqual([
      { label: "Words", value: "--" },
      { label: "Lines", value: "--" },
      { label: "Mode", value: "Rich" },
      { label: "Save", value: "Idle shell" }
    ]);
  });
});

describe("getExplorerNodes", () => {
  it("builds workspace-first entries when a folder is active", () => {
    expect(
      getExplorerNodes({
        ...initialShellState,
        activeFolder: "/tmp/pluma",
        activeFile: "/tmp/pluma/notes.md"
      })[0]
    ).toMatchObject({
      kind: "folder",
      label: "Guides"
    });
  });
});
