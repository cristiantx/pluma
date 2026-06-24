import { describe, expect, it } from "vitest";

import { getDesktopDocumentAssetBaseUrl } from "../src/shell/desktopAssetUrls.js";

describe("getDesktopDocumentAssetBaseUrl", () => {
  it("creates a local asset protocol base URL from a desktop document path", () => {
    expect(
      getDesktopDocumentAssetBaseUrl(
        "/Users/me/Documents/Project Notes/Notes.md"
      )
    ).toBe("pluma-asset://local/Users/me/Documents/Project%20Notes/");
  });

  it("creates a local asset protocol base URL from a Windows document path", () => {
    expect(getDesktopDocumentAssetBaseUrl("C:\\Users\\me\\Notes.md")).toBe(
      "pluma-asset://local/C%3A/Users/me/"
    );
  });
});
