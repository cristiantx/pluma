import { describe, expect, it } from "vitest";

import {
  analyzeMarkdownText,
  getMarkdownDocumentModeConstraint,
  markdownPipeline,
  serializeMarkdownSession
} from "../src/index.js";
import { createDocumentSession } from "../src/documentSession.js";

describe("markdownPipeline", () => {
  it("allows CommonMark basics in rich mode", () => {
    const analysis = analyzeMarkdownText(`# Title

This is **bold**, _emphasized_, and [linked](./guide.md).

- One
- Two
`);

    expect(analysis).toEqual({
      modeConstraint: "none",
      unsupportedConstructs: []
    });
    expect(getMarkdownDocumentModeConstraint(analysis)).toBe("none");
  });

  it("allows GFM tables in rich mode", () => {
    const parseResult = markdownPipeline.parse(`| Name | Value |
| --- | ---: |
| Alpha | 1 |
`);

    expect(markdownPipeline.analyze(parseResult).modeConstraint).toBe("none");
  });

  it("allows task lists in rich mode", () => {
    expect(
      analyzeMarkdownText(`- [x] Draft
- [ ] Review
`).modeConstraint
    ).toBe("none");
  });

  it("allows fenced code blocks in rich mode", () => {
    expect(
      analyzeMarkdownText(`\`\`\`ts
const name = "Pluma";
\`\`\`
`).modeConstraint
    ).toBe("none");
  });

  it("allows YAML frontmatter in rich mode", () => {
    expect(
      analyzeMarkdownText(`---
title: Draft
---

# Heading
`).modeConstraint
    ).toBe("none");
  });

  it("allows relative links and images in rich mode", () => {
    expect(
      analyzeMarkdownText(`[Guide](../guide.md)

![Logo](./images/logo.png)
`).modeConstraint
    ).toBe("none");
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
      modeConstraint: "source-only",
      rawText
    });

    const result = serializeMarkdownSession(session);

    expect(analyzeMarkdownText(rawText)).toMatchObject({
      modeConstraint: "source-only",
      unsupportedConstructs: [{ kind: "html" }]
    });
    expect(
      getMarkdownDocumentModeConstraint(analyzeMarkdownText(rawText))
    ).toBe("source-only");
    expect(result.markdown).toBe(rawText);
    expect(result.fidelityWarnings.length).toBeGreaterThan(0);
  });

  it("preserves source text instead of round-trip formatting", () => {
    const rawText = "* one\n* two\n";
    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/Users/me/Documents/bullets.md"
      },
      metadata: null,
      mode: "rich",
      rawText
    });

    expect(serializeMarkdownSession(session)).toEqual({
      fidelityWarnings: [],
      markdown: rawText
    });
  });

  it("returns policy warnings only for source-only documents", () => {
    const sourceOnlySession = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/Users/me/Documents/source-only.md"
      },
      metadata: null,
      mode: "source",
      modeConstraint: "source-only",
      rawText: "<aside>Keep exact</aside>\n"
    });

    expect(serializeMarkdownSession(sourceOnlySession)).toEqual({
      fidelityWarnings: [
        "Inline or block HTML is preserved in source mode because rich editing could change execution or rendering semantics."
      ],
      markdown: "<aside>Keep exact</aside>\n"
    });
  });
});
