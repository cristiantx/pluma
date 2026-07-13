import { describe, expect, it } from "vitest";

import { isMarkdownFilePath } from "../src/markdownFiles.js";

describe("isMarkdownFilePath", () => {
  it("recognizes supported Markdown extensions across path styles", () => {
    expect(isMarkdownFilePath("/notes/Entry.md")).toBe(true);
    expect(isMarkdownFilePath("C:\\notes\\Entry.MARKDOWN")).toBe(true);
    expect(isMarkdownFilePath("Entry.mdown?raw=1#intro")).toBe(true);
  });

  it("rejects extensionless and non-Markdown paths", () => {
    expect(isMarkdownFilePath("/notes/Entry")).toBe(false);
    expect(isMarkdownFilePath("/notes/Entry.md.png")).toBe(false);
  });
});
