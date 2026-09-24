import { describe, expect, it } from "vitest";

import { reconcileEditorSearchStatus } from "../src/shell/editorSearchStatus.js";

describe("editor search status", () => {
  it("preserves identity across unchanged cursor status snapshots", () => {
    const current = { current: 1, total: 3, valid: true };

    expect(reconcileEditorSearchStatus(current, { ...current })).toBe(current);
  });

  it.each([
    { current: 2, total: 3, valid: true },
    { current: 1, total: 4, valid: true },
    { current: 1, total: 3, valid: false }
  ])("publishes a changed status: %j", (next) => {
    const current = { current: 1, total: 3, valid: true };

    expect(reconcileEditorSearchStatus(current, next)).toBe(next);
  });
});
