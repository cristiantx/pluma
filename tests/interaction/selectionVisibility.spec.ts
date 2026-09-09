import { expect, test, type Locator, type Page } from "@playwright/test";
import { selectionSnapshot } from "./editorStateHarness";
import {
  documentSnapshot,
  hydrate,
  setSurface,
  textPoint
} from "./rendererHarness";

const markdown = `# Selection visibility

Ordinary selectable paragraph.

| Header selectable | Other heading |
| --- | --- |
| Body selectable | First neighbor |
| Stripe selectable | Second neighbor |

\`\`\`text
Code selectable content.
\`\`\`
`;

// Read actual painted pixels, rather than testing CSS that can still be occluded.
async function paintedPixels(
  page: Page,
  target: Locator,
  from: number,
  to: number
) {
  const clip = await target.evaluate(
    (element, { from, to }) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let offset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const end = offset + node.textContent!.length;
        if (from >= offset && from < end) range.setStart(node, from - offset);
        if (to > offset && to <= end) {
          range.setEnd(node, to - offset);
          break;
        }
        offset = end;
      }
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    { from, to }
  );
  const screenshot = await page.screenshot({ clip, caret: "hide" });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(
      context.getImageData(0, 0, image.width, image.height).data
    );
  }, screenshot.toString("base64"));
}

for (const theme of ["light", "dark"] as const) {
  test(`rich selection is painted over table and code surfaces in ${theme}`, async ({
    page
  }, testInfo) => {
    await page.goto("/");
    await hydrate(page, markdown);
    await setSurface(page, theme);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const prefix of ["Header", "Body", "Stripe", "Ordinary", "Code"]) {
      const target = page
        .locator(
          prefix === "Header" || prefix === "Body" || prefix === "Stripe"
            ? ".cm-draftly-table-cell"
            : ".cm-line"
        )
        .filter({ hasText: new RegExp(`^${prefix} selectable`) });
      const from = prefix.length + 1;
      const to = from + "selectable".length;
      const start = await textPoint(target, from);
      const end = await textPoint(target, to);
      await page.mouse.click(start.x, start.y);
      const before = await paintedPixels(page, target, from, to);
      const untouched = await paintedPixels(page, target, 0, prefix.length);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(async () => (await selectionSnapshot(page)).text)
        .toBe("selectable");
      await expect(
        page
          .locator(".pluma-rich-selection-layer .cm-selectionBackground")
          .first()
      ).toBeVisible();
      const after = await paintedPixels(page, target, from, to);
      // Selecting a word must not tint its unselected prefix or neighboring cells.
      const untouchedAfter = await paintedPixels(
        page,
        target,
        0,
        prefix.length
      );
      expect(
        Math.max(
          ...untouchedAfter.map((value, index) =>
            Math.abs(value - untouched[index]!)
          )
        ),
        `${prefix} unselected text must not be highlighted`
      ).toBeLessThan(5);
      expect(after.length).toBe(before.length);
      let changed = 0;
      let readableInk = 0;
      for (let i = 0; i < after.length; i += 4) {
        if (
          Math.max(
            ...after
              .slice(i, i + 3)
              .map((value, channel) => Math.abs(value - before[i + channel]!))
          ) > 20
        )
          changed++;
        const brightness = (after[i]! + after[i + 1]! + after[i + 2]!) / 3;
        if (theme === "light" ? brightness < 140 : brightness > 160)
          readableInk++;
      }
      await page.screenshot({
        path: testInfo.outputPath(`${theme}-${prefix}-selection.png`)
      });
      expect(
        changed / (after.length / 4),
        `${prefix} selection must be visible`
      ).toBeGreaterThan(0.45);
      expect(
        readableInk / (after.length / 4),
        `${prefix} text must remain readable`
      ).toBeGreaterThan(0.04);
    }
    expect(await documentSnapshot(page)).toEqual({
      rawText: markdown,
      saveState: "idle"
    });
    expect(errors).toEqual([]);
  });
}
