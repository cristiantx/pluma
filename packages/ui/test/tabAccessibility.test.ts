import { describe, expect, it } from "vitest";

import {
  getKeyboardTabIndex,
  getTabButtonId
} from "../src/shell/tabAccessibility.js";

describe("tab keyboard navigation", () => {
  it("wraps in both directions", () => {
    expect(getKeyboardTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(getKeyboardTabIndex("ArrowRight", 2, 3)).toBe(0);
  });

  it("supports first and last tab navigation", () => {
    expect(getKeyboardTabIndex("Home", 1, 3)).toBe(0);
    expect(getKeyboardTabIndex("End", 1, 3)).toBe(2);
  });

  it("leaves other keyboard input alone and handles empty lists", () => {
    expect(getKeyboardTabIndex("Tab", 1, 3)).toBeNull();
    expect(getKeyboardTabIndex("ArrowRight", 0, 0)).toBeNull();
    expect(getKeyboardTabIndex("ArrowLeft", 0, 1)).toBe(0);
  });

  it("keeps distinct document IDs distinct in accessible relationships", () => {
    expect(getTabButtonId("a/b")).not.toBe(getTabButtonId("a%2Fb"));
    expect(getTabButtonId("a b")).not.toContain(" ");
  });
});
