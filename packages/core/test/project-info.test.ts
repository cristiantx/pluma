import { describe, expect, it } from "vitest";

import { getFileLocationName, projectInfo } from "../src/index.js";

describe("projectInfo", () => {
  it("marks the project as local-first", () => {
    expect(projectInfo.localFirst).toBe(true);
  });

  it("tracks the current shared location kinds", () => {
    expect(projectInfo.locationKinds).toEqual([
      "desktop-path",
      "browser-file-handle"
    ]);
  });

  it("extracts display names from shared file locations", () => {
    expect(
      getFileLocationName({
        kind: "desktop-path",
        path: "/Users/me/Documents/README.md"
      })
    ).toBe("README.md");

    expect(
      getFileLocationName({
        kind: "browser-file-handle",
        handleKey: "browser-123",
        name: "Draft.md"
      })
    ).toBe("Draft.md");
  });
});
