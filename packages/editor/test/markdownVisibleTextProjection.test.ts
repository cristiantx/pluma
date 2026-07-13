import { describe, expect, it } from "vitest";

import {
  projectMarkdownVisibleText,
  sourceOffsetFromMarkdownVisible,
  sourceOffsetFromVisibleOffset,
  visibleOffsetFromMarkdownSource,
  visibleOffsetFromSourceOffset
} from "../src/markdownVisibleTextProjection.js";

describe("projectMarkdownVisibleText", () => {
  it("maps heading source offsets to visible text offsets", () => {
    const projection = projectMarkdownVisibleText("# Hello world\n");
    const sourceOffset = "# Hello world\n".indexOf("world");
    const visibleOffset = "Hello world\n".indexOf("world");

    expect(projection.text).toBe("Hello world\n");
    expect(visibleOffsetFromSourceOffset(projection, sourceOffset)).toBe(
      visibleOffset
    );
    expect(sourceOffsetFromVisibleOffset(projection, visibleOffset)).toBe(
      sourceOffset
    );
  });

  it("skips inline emphasis markers around a word", () => {
    const projection = projectMarkdownVisibleText("A **bold** word");
    const sourceOffset = "A **bold** word".indexOf("bold");
    const visibleOffset = "A bold word".indexOf("bold");

    expect(projection.text).toBe("A bold word");
    expect(visibleOffsetFromSourceOffset(projection, sourceOffset)).toBe(
      visibleOffset
    );
    expect(sourceOffsetFromVisibleOffset(projection, visibleOffset)).toBe(
      sourceOffset
    );
  });

  it.each([
    "",
    "plain text",
    "# Heading\n\nParagraph",
    "> quoted\n- item\n12) ordered",
    "A **bold** _word_ and `code`",
    "Escaped \\*marker and ~~strike~~",
    "Unicode 😀 café 漢字\n"
  ])("keeps streaming offset conversions equivalent for %j", (markdown) => {
    const projection = projectMarkdownVisibleText(markdown);

    for (
      let sourceOffset = -1;
      sourceOffset <= markdown.length + 1;
      sourceOffset += 1
    ) {
      expect(visibleOffsetFromMarkdownSource(markdown, sourceOffset)).toBe(
        visibleOffsetFromSourceOffset(projection, sourceOffset)
      );
    }

    for (
      let visibleOffset = -1;
      visibleOffset <= projection.text.length + 1;
      visibleOffset += 1
    ) {
      expect(sourceOffsetFromMarkdownVisible(markdown, visibleOffset)).toBe(
        sourceOffsetFromVisibleOffset(projection, visibleOffset)
      );
    }
  });
});
