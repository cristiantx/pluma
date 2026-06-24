import { describe, expect, it } from "vitest";

import { findMarkdownHeadingAnchorPosition } from "../src/shell/markdownHeadingAnchors.js";

describe("findMarkdownHeadingAnchorPosition", () => {
  it("finds GitHub-like heading fragments", () => {
    const markdown = `Intro

## Install Pluma!

Body
`;

    expect(findMarkdownHeadingAnchorPosition(markdown, "install-pluma")).toBe(
      7
    );
  });

  it("handles encoded fragments and duplicate headings", () => {
    const markdown = `# API Reference

## API Reference

## API Reference
`;

    expect(
      findMarkdownHeadingAnchorPosition(markdown, "API%20Reference-1")
    ).toBe(17);
  });

  it("returns null for missing headings", () => {
    expect(findMarkdownHeadingAnchorPosition("# Start\n", "missing")).toBeNull();
  });
});
