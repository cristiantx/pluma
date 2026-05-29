import { describe, expect, it } from "vitest";

import {
  analyzeMarkdownText,
  getMarkdownDocumentCapability,
  guardMarkdownRoundTrip,
  markdownPipeline,
  parseMarkdown,
  serializeMarkdownSession
} from "../src/index.js";
import { createDocumentSession } from "../src/documentSession.js";

describe("markdownPipeline", () => {
  it("parses CommonMark basics as rich-mode safe", () => {
    const analysis = analyzeMarkdownText(`# Title

This is **bold**, _emphasized_, and [linked](./guide.md).

- One
- Two
`);

    expect(analysis).toEqual({
      supportsRichMode: true,
      unsupportedConstructs: []
    });
    expect(getMarkdownDocumentCapability(analysis)).toBe("rich-safe");
  });

  it("parses GFM tables as rich-mode safe", () => {
    const parseResult = markdownPipeline.parse(`| Name | Value |
| --- | ---: |
| Alpha | 1 |
`);

    expect(markdownPipeline.analyze(parseResult).supportsRichMode).toBe(true);
  });

  it("parses task lists as rich-mode safe", () => {
    expect(
      analyzeMarkdownText(`- [x] Draft
- [ ] Review
`).supportsRichMode
    ).toBe(true);
  });

  it("parses fenced code blocks as rich-mode safe", () => {
    expect(
      analyzeMarkdownText(`\`\`\`ts
const name = "Pluma";
\`\`\`
`).supportsRichMode
    ).toBe(true);
  });

  it("parses YAML frontmatter as rich-mode safe", () => {
    expect(
      analyzeMarkdownText(`---
title: Draft
---

# Heading
`).supportsRichMode
    ).toBe(true);
  });

  it("keeps relative links and images rich-mode safe", () => {
    expect(
      analyzeMarkdownText(`[Guide](../guide.md)

![Logo](./images/logo.png)
`).supportsRichMode
    ).toBe(true);
  });

  it("marks HTML as source-only so unsafe syntax is not destroyed", () => {
    const rawText = `<section onclick="alert('x')">
  <strong>Keep me exact</strong>
</section>
`;

    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/Users/me/Documents/unsafe.md"
      },
      metadata: null,
      rawText
    });

    const result = serializeMarkdownSession(session);

    expect(analyzeMarkdownText(rawText)).toMatchObject({
      supportsRichMode: false,
      unsupportedConstructs: [{ kind: "html" }]
    });
    expect(getMarkdownDocumentCapability(analyzeMarkdownText(rawText))).toBe(
      "source-only"
    );
    expect(result.markdown).toBe(rawText);
    expect(result.fidelityWarnings.length).toBeGreaterThan(0);
  });

  it("preserves original source when serialization changes formatting", () => {
    const rawText = "- one\n- two\n";
    const result = guardMarkdownRoundTrip(parseMarkdown(rawText));

    expect(result.markdown).toBe(rawText);
    expect(result.fidelityWarnings).toEqual([
      "Markdown serialization changed the source text. Source text was preserved to avoid losing document fidelity."
    ]);
  });
});
