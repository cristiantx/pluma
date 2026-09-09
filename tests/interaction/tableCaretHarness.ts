import { expect, type Locator, type Page } from "@playwright/test";

// Measure rendered glyphs and the actual cursor layer independently of CodeMirror's
// source-to-coordinate API. Correct insertion alone misses invisible edge carets.
export async function expectCellCaret(
  cell: Locator,
  offset: number,
  side: -1 | 1 = -1,
  primary = true
) {
  await cell.evaluate(() => {
    if (document.getElementById("test-caret-blink")) return;
    const style = document.createElement("style");
    style.id = "test-caret-blink";
    style.textContent = ".cm-cursorLayer { animation: none !important; }";
    document.head.append(style);
  });
  let lastMeasurement: unknown;
  await expect
    .poll(async () => {
      lastMeasurement = await cell.evaluate(
        (element, { offset, side, primary }) => {
          const editor = element.closest(".cm-editor")!;
          const cursor = editor.querySelector(
            primary
              ? ".cm-cursor-primary"
              : ".cm-cursor:not(.cm-cursor-primary)"
          );
          if (!cursor) return { matches: false, reason: "No rendered caret" };
          const after = side < 0 && offset > 0;
          let remaining = after ? offset - 1 : offset;
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT
          );
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.parentElement?.closest("[contenteditable=false]"))
              continue;
            const length = node.textContent!.length;
            if (remaining >= length) {
              remaining -= length;
              continue;
            }
            const glyph = document.createRange();
            glyph.setStart(node, remaining);
            glyph.setEnd(node, remaining + 1);
            const text = glyph.getBoundingClientRect();
            const caret = cursor.getBoundingClientRect();
            const viewport = editor
              .querySelector(".cm-scroller")!
              .getBoundingClientRect();
            const style = getComputedStyle(cursor);
            const matches =
              editor.contains(document.activeElement) &&
              style.visibility === "visible" &&
              getComputedStyle(cursor.parentElement!).opacity === "1" &&
              caret.height > 5 &&
              Math.abs(caret.left - (after ? text.right : text.left)) < 2 &&
              Math.abs(caret.top - text.top) < 2 &&
              Math.abs(caret.bottom - text.bottom) < 2 &&
              caret.top >= viewport.top &&
              caret.bottom <= viewport.bottom;
            return {
              matches,
              text: element.textContent,
              offset,
              side,
              caret: caret.toJSON(),
              glyph: text.toJSON(),
              viewport: viewport.toJSON(),
              focused: editor.contains(document.activeElement),
              visibility: style.visibility,
              opacity: getComputedStyle(cursor.parentElement!).opacity,
              nativeNode: document.getSelection()?.focusNode?.textContent,
              nativeOffset: document.getSelection()?.focusOffset
            };
          }
          throw new Error(`Missing visible cell text offset ${offset}`);
        },
        { offset, side, primary }
      );
      return lastMeasurement;
    })
    .toMatchObject({ matches: true })
    .catch((error) => {
      throw new Error(
        `Cell caret geometry: ${JSON.stringify(lastMeasurement)}`,
        { cause: error }
      );
    });
}

export async function scrollSnapshot(page: Page) {
  return page.locator(".cm-scroller").evaluate(async (element) => {
    // Let pending editor measurement and scrolling finish before comparing.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return {
      top: element.scrollTop,
      left: element.scrollLeft,
      windowX: window.scrollX,
      windowY: window.scrollY
    };
  });
}

export async function expectScrollUnchanged(
  page: Page,
  before: Awaited<ReturnType<typeof scrollSnapshot>>
) {
  expect(await scrollSnapshot(page)).toEqual(before);
}
