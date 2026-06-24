import { describe, expect, it } from "vitest";

import { resolveRichEditorImageUrl } from "../src/richEditorImageUrls.js";

describe("resolveRichEditorImageUrl", () => {
  const baseUrl = "pluma-asset://local/Users/me/Documents/Notes/";

  it("resolves relative image URLs against the document asset base", () => {
    expect(resolveRichEditorImageUrl("./images/logo.png", baseUrl)).toBe(
      "pluma-asset://local/Users/me/Documents/Notes/images/logo.png"
    );
  });

  it("preserves absolute and externally resolved URLs", () => {
    expect(
      resolveRichEditorImageUrl("https://example.com/logo.png", baseUrl)
    ).toBe("https://example.com/logo.png");
    expect(
      resolveRichEditorImageUrl("data:image/png;base64,abc", baseUrl)
    ).toBe("data:image/png;base64,abc");
    expect(resolveRichEditorImageUrl("#local-image", baseUrl)).toBe(
      "#local-image"
    );
  });

  it("preserves relative URLs when no base is available", () => {
    expect(resolveRichEditorImageUrl("./images/logo.png", undefined)).toBe(
      "./images/logo.png"
    );
  });
});
