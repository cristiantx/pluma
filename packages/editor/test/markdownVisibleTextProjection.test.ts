import { describe, expect, it } from "vitest";

import {
  projectMarkdownVisibleText,
  sourceOffsetFromVisibleOffset,
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
});
