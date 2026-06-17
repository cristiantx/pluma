import { describe, expect, it } from "vitest";

import { renderMarkdownExportHtml } from "../src/index.js";

describe("renderMarkdownExportHtml", () => {
  it("renders supported Markdown as sanitized HTML", async () => {
    const html = await renderMarkdownExportHtml(`# Title

Paragraph with **bold** text and [a link](./guide.md).

- [x] Done
- [ ] Next

| Name | Value |
| --- | ---: |
| Alpha | 1 |

\`\`\`ts
const value = 1;
\`\`\`
`);

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('<a href="./guide.md">a link</a>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<table>");
    expect(html).toContain('<code class="language-ts">');
  });

  it("does not render YAML frontmatter as visible content", async () => {
    const html = await renderMarkdownExportHtml(`---
title: Draft
---

# Visible
`);

    expect(html).toContain("<h1>Visible</h1>");
    expect(html).not.toContain("title: Draft");
  });

  it("strips unsafe HTML and unsafe URL protocols", async () => {
    const html = await renderMarkdownExportHtml(`<script>alert("x")</script>

<img src="x" onerror="alert('x')">

[Unsafe](javascript:alert('x'))
`);

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });
});
