import { describe, expect, it } from "vitest";

import { reorderTabItems } from "../src/adapters/tabModel.js";

const tabs = [
  {
    id: "welcome",
    location: {
      kind: "desktop-path" as const,
      path: "/tmp/Welcome.md"
    },
    title: "Welcome.md"
  },
  {
    id: "syntax",
    location: {
      kind: "desktop-path" as const,
      path: "/tmp/Syntax.md"
    },
    title: "Syntax.md"
  },
  {
    id: "outline",
    location: {
      kind: "desktop-path" as const,
      path: "/tmp/Outline.md"
    },
    title: "Outline.md"
  }
];

describe("reorderTabItems", () => {
  it("moves a tab to a new index", () => {
    expect(reorderTabItems(tabs, 0, 2).map((tab) => tab.id)).toEqual([
      "syntax",
      "outline",
      "welcome"
    ]);
  });

  it("returns the same order when the move is invalid", () => {
    expect(reorderTabItems(tabs, -1, 2)).toEqual(tabs);
    expect(reorderTabItems(tabs, 1, 1)).toEqual(tabs);
  });
});
