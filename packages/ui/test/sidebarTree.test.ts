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
});
