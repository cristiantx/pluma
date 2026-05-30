import { describe, expect, it } from "vitest";

import {
  createDocumentSession,
  formatMarkdownText,
  normalizeAccidentalLooseLists,
  serializeMarkdownSession
} from "../src/index.js";

describe("formatMarkdownText", () => {
  it("keeps task lists tight and uses dash task markers", async () => {
    await expect(
      formatMarkdownText("* [ ] One\n\n* [x] Two\n").then(
        (result) => result.markdown
      )
    ).resolves.toBe("- [ ] One\n- [x] Two\n");
  });

  it("keeps bullet and ordered lists stable", async () => {
    await expect(
      formatMarkdownText("* One\n\n* Two\n\n1. First\n\n2. Second\n").then(
        (result) => result.markdown
      )
    ).resolves.toBe("- One\n- Two\n\n1. First\n2. Second\n");
  });

  it("keeps GFM tables valid", async () => {
    await expect(
      formatMarkdownText(`| Name | Value |
| --- | ---: |
| Alpha | 1 |
`).then((result) => result.markdown)
    ).resolves.toBe(`| Name  | Value |
| ----- | ----: |
| Alpha |     1 |
`);
  });

  it("keeps YAML frontmatter at the top", async () => {
    await expect(
      formatMarkdownText(`---
title: Draft
---

# Heading
`).then((result) => result.markdown)
    ).resolves.toBe(`---
title: Draft
---

# Heading
`);
  });

  it("keeps fenced code block language info", async () => {
    await expect(
      formatMarkdownText(`\`\`\`ts
const value = 1
\`\`\`
`).then((result) => result.markdown)
    ).resolves.toBe(`\`\`\`ts
const value = 1
\`\`\`
`);
  });

  it("keeps unsupported HTML available for source-only routing", async () => {
    await expect(
      formatMarkdownText("<aside>Keep exact</aside>\n").then(
        (result) => result.markdown
      )
    ).resolves.toBe("<aside>Keep exact</aside>\n");
  });

  it("produces output that can pass the rich-mode round-trip guard", async () => {
    const formatResult = await formatMarkdownText("- [ ] One\n\n- [x] Two\n");
    const session = createDocumentSession({
      capability: "rich-safe",
      location: {
        kind: "desktop-path",
        path: "/tmp/pluma/tasks.md"
      },
      metadata: null,
      mode: "rich",
      rawText: formatResult.markdown
    });

    expect(serializeMarkdownSession(session)).toEqual({
      fidelityWarnings: [],
      markdown: "- [ ] One\n- [x] Two\n"
    });
  });
});

describe("normalizeAccidentalLooseLists", () => {
  it("does not collapse multi-paragraph list items", () => {
    expect(
      normalizeAccidentalLooseLists("- One\n\n  Continued paragraph\n\n- Two\n")
    ).toBe("- One\n\n  Continued paragraph\n\n- Two\n");
  });
});
