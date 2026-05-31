import { describe, expect, it } from "vitest";

import { buildSidebarTreeData } from "../src/adapters/sidebarTree.js";

describe("buildSidebarTreeData", () => {
  it("builds a nested tree structure from flat sidebar nodes", () => {
    const treeData = buildSidebarTreeData("PLUMA DOCS", [
      { depth: 0, kind: "folder", label: "Guides" },
      { depth: 1, kind: "file", label: "Welcome.md", isActive: true },
      { depth: 1, kind: "file", label: "Syntax.md" },
      { depth: 0, kind: "file", label: "README.md" }
    ]);

    expect(treeData.rootItemId).toBe("workspace-root");
    expect(treeData.expandedItems).toContain("workspace-root");
    expect(treeData.expandedItems).not.toContain("workspace-root/guides-0");
    expect(treeData.selectedItems).toHaveLength(1);
    expect(treeData.tree["workspace-root"]?.children).toHaveLength(2);
  });

  it("returns the file and ancestor folders for reveal requests", () => {
    const treeData = buildSidebarTreeData(
      "PLUMA DOCS",
      [
        {
          depth: 0,
          id: "/workspace/guides",
          kind: "folder",
          label: "Guides",
          location: { kind: "desktop-path", path: "/workspace/guides" }
        },
        {
          depth: 1,
          id: "/workspace/guides/deep",
          kind: "folder",
          label: "Deep",
          location: { kind: "desktop-path", path: "/workspace/guides/deep" }
        },
        {
          depth: 2,
          id: "/workspace/guides/deep/syntax.md",
          kind: "file",
          label: "Syntax.md",
          location: {
            kind: "desktop-path",
            path: "/workspace/guides/deep/syntax.md"
          }
        }
      ],
      "/workspace/guides/deep/syntax.md"
    );

    expect(treeData.revealItemId).toBe("/workspace/guides/deep/syntax.md");
    expect(treeData.revealExpandedItems).toEqual([
      "workspace-root",
      "/workspace/guides",
      "/workspace/guides/deep"
    ]);
  });
});
