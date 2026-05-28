import { describe, expect, it } from "vitest";

import { resolveFileLocationReference } from "../src/index.js";

describe("resolveFileLocationReference", () => {
  it("resolves relative references against the active desktop file path", () => {
    expect(
      resolveFileLocationReference(
        {
          kind: "desktop-path",
          path: "/Users/me/Documents/Guides/Welcome.md"
        },
        "../Images/logo.png"
      )
    ).toEqual({
      kind: "desktop-path",
      path: "/Users/me/Documents/Images/logo.png"
    });
  });

  it("returns null for external or in-document references", () => {
    expect(
      resolveFileLocationReference(
        {
          kind: "desktop-path",
          path: "/Users/me/Documents/Guides/Welcome.md"
        },
        "https://example.com"
      )
    ).toBeNull();

    expect(
      resolveFileLocationReference(
        {
          kind: "desktop-path",
          path: "/Users/me/Documents/Guides/Welcome.md"
        },
        "#overview"
      )
    ).toBeNull();
  });

  it("returns null for non-desktop file locations", () => {
    expect(
      resolveFileLocationReference(
        {
          kind: "browser-file-handle",
          handleKey: "browser-1",
          name: "Draft.md"
        },
        "./child.md"
      )
    ).toBeNull();
  });
});
