import { expect, test, type Locator, type Page } from "@playwright/test";
import { selectionSnapshot } from "./editorStateHarness";
import {
  documentSnapshot,
  hydrate,
  setSurface,
  textPoint
} from "./rendererHarness";

async function drag(page: Page, target: Locator, from: number, to: number) {
  const start = await textPoint(target, from);
  const end = await textPoint(target, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

async function expectTextBounds(
  page: Page,
  target: Locator,
  from: number,
  to: number
) {
  const expected = await target.evaluate(
    (element, { from, to }) => {
      const range = document.createRange();
      range.setStart(element.firstChild!, from);
      range.setEnd(element.firstChild!, to);
      return Array.from(range.getClientRects(), ({ x, y, width, height }) => ({
        x,
        y,
        width,
        height
      }));
    },
    { from, to }
  );
  await expect
    .poll(async () => {
      const actual = await page
        .locator(".pluma-rich-selection-layer .cm-selectionBackground")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          })
        );
      return expected.every((rect) =>
        actual.some(
          (marker) =>
            Math.abs(marker.x - rect.x) < 1 &&
            Math.abs(marker.y - rect.y) < 1 &&
            Math.abs(marker.width - rect.width) < 1 &&
            Math.abs(marker.height - rect.height) < 1
        )
      );
    })
    .toBe(true);
  return expected.length;
}

test("wrapped, scrolled table selections follow text bounds and keyboard extension", async ({
  page
}) => {
  await page.setViewportSize({ width: 960, height: 640 });
  await page.goto("/");
  const text =
    "Wrapped words remain selectable across several visual lines within this table cell, including the final selected words.";
  const markdown =
    "Before the table.\n\n".repeat(8) +
    `| Heading | Other heading |\n| --- | --- |\n| ${text} | Neighbor text stays unselected. |\n\nAfter table.\n`;
  await hydrate(page, markdown);
  const target = page
    .locator(".cm-draftly-table-cell")
    .filter({ hasText: text });
  await drag(page, target, 95, 8);
  await expect
    .poll(async () => (await selectionSnapshot(page)).text)
    .toBe(text.slice(8, 95));
  expect(await expectTextBounds(page, target, 8, 95)).toBeGreaterThan(1);
  await page.keyboard.press("Shift+ArrowLeft");
  await expect
    .poll(async () => (await selectionSnapshot(page)).text)
    .toBe(text.slice(7, 95));
  await expectTextBounds(page, target, 7, 95);
  await setSurface(page, "dark");
  await expectTextBounds(page, target, 7, 95);
  await page.keyboard.insertText("REPLACEMENT");
  expect((await documentSnapshot(page)).rawText).toBe(
    markdown.replace(text, text.slice(0, 7) + "REPLACEMENT" + text.slice(95))
  );
});

test("selection across table cells highlights each selected cell fragment", async ({
  page
}) => {
  await page.goto("/");
  const markdown =
    "| Head A | Head B |\n| --- | --- |\n| Alpha bravo | Charlie delta |\n| Echo foxtrot | Golf hotel |\n\nAfter table.\n";
  await hydrate(page, markdown);
  const cell = (text: string) =>
    page
      .locator(".cm-draftly-table-cell")
      .filter({ hasText: new RegExp(`^${text}$`) });
  const start = await textPoint(cell("Alpha bravo"), 6);
  const end = await textPoint(cell("Golf hotel"), 4);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  const from = markdown.indexOf("bravo");
  const to = markdown.indexOf("Golf") + 4;
  await expect
    .poll(async () => (await selectionSnapshot(page)).text)
    .toBe(markdown.slice(from, to));
  await expectTextBounds(page, cell("Alpha bravo"), 6, 11);
  await expectTextBounds(page, cell("Charlie delta"), 0, 13);
  await expectTextBounds(page, cell("Echo foxtrot"), 0, 12);
  await expectTextBounds(page, cell("Golf hotel"), 0, 4);
  await expect(
    page.locator(".pluma-rich-selection-layer .cm-selectionBackground")
  ).toHaveCount(4);
  expect(await documentSnapshot(page)).toEqual({
    rawText: markdown,
    saveState: "idle"
  });
});

test("multiple table selections survive mode changes and replace both ranges", async ({
  page
}) => {
  await page.goto("/");
  const markdown =
    "| Header | Other |\n| --- | --- |\n| Alpha bravo | Charlie delta |\n";
  await hydrate(page, markdown);
  const first = page
    .locator(".cm-draftly-table-cell")
    .filter({ hasText: /^Alpha bravo$/ });
  const second = page
    .locator(".cm-draftly-table-cell")
    .filter({ hasText: /^Charlie delta$/ });
  await drag(page, first, 6, 11);
  const modifier = await page.evaluate(() =>
    navigator.platform.includes("Mac") ? "Meta" : "Control"
  );
  await page.keyboard.down(modifier);
  await drag(page, second, 8, 13);
  await page.keyboard.up(modifier);
  await expect(
    page.locator(".pluma-rich-selection-layer .cm-selectionBackground")
  ).toHaveCount(2);
  for (const theme of ["dark", "light"] as const) {
    await setSurface(page, theme);
    await expectTextBounds(page, first, 6, 11);
    await expectTextBounds(page, second, 8, 13);
  }
  await setSurface(page, "source");
  await expect(page.locator(".pluma-rich-selection-layer")).toHaveCount(0);
  await expect(
    page.locator(".source-pane .cm-selectionBackground").first()
  ).toBeVisible();
  await setSurface(page, "rich");
  await expectTextBounds(page, first, 6, 11);
  await expectTextBounds(page, second, 8, 13);
  await page.locator(".rich-editor .cm-content").focus();
  await page.keyboard.insertText("BOTH");
  expect((await documentSnapshot(page)).rawText).toBe(
    markdown.replace("bravo", "BOTH").replace("delta", "BOTH")
  );
});
