import { describe, expect, it } from "vitest";

import { projectInfo } from "@pluma/core";

import { createEditorFoundation } from "../src/index.js";

describe("createEditorFoundation", () => {
  it("enables both source and rich modes", () => {
    expect(createEditorFoundation(projectInfo)).toEqual({
      packageName: "@pluma/editor",
      supportsSourceMode: true,
      supportsRichMode: true
    });
  });
});
