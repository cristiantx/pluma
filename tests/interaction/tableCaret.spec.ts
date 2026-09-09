import { expect, test } from "@playwright/test";
import { markdownFixture } from "./markdownFixture";
import {
  documentSnapshot,
  hydrate,
  setSurface,
  textPoint
} from "./rendererHarness";
import {
  expectCellCaret,
  expectScrollUnchanged,
  scrollSnapshot
} from "./tableCaretHarness";
import {
  cancelledCell,
  cellLineEnd,
  tableWhitespaceMarkdown
} from "./tableWhitespaceHarness";

const paddedTable = `| Left heading | Center heading | Right heading |
| :--- | :---: | ---: |
| Left content | Centered content | Right content |
|  | Neighbor of the empty cell | Final cell |

`;

for (const theme of ["light", "dark"] as const) {
  test(`cell padding and keyboard boundaries keep a visible caret in ${theme}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 960, height: 640 });
    await page.goto("/");
    const markdown =
      "Before table.\n\n".repeat(8) +
      paddedTable +
      "After table.\n\n".repeat(30);
    for (const index of [0, 3, 4, 5]) {
      for (const side of [1, -1] as const) {
        await hydrate(page, markdown);
        await setSurface(page, theme);
        const cell = page.locator(".cm-draftly-table-cell").nth(index);
        await cell.scrollIntoViewIfNeeded();
        const text = (await cell.textContent())!;
        const point = await cell.evaluate((element, side) => {
          const rect = element.getBoundingClientRect();
          return {
            // The add-column button overlaps the outermost table edge.
            x: side === 1 ? rect.left + 3 : rect.right - 14,
            y: (rect.top + rect.bottom) / 2
          };
        }, side);
        expect(
          await cell.evaluate(
            (element, point) =>
              document
                .elementFromPoint(point.x, point.y)
                ?.closest(".cm-draftly-table-cell") === element,
            point
          )
        ).toBe(true);
        const scroll = await scrollSnapshot(page);
        const offset = side === 1 ? 0 : text.length;
        await page.mouse.click(point.x, point.y);
        await expectCellCaret(cell, offset, side);
        await expectScrollUnchanged(page, scroll);
        await page.keyboard.type("X");
        await expectCellCaret(cell, offset + 1);
        await expectScrollUnchanged(page, scroll);
        const position = markdown.indexOf(text) + offset;
        expect((await documentSnapshot(page)).rawText).toBe(
          markdown.slice(0, position) + "X" + markdown.slice(position)
        );
        await page.keyboard.press("Backspace");
        await expectCellCaret(cell, offset, side);
        await expectScrollUnchanged(page, scroll);
      }
    }

    await hydrate(page, markdown);
    const empty = page.locator(".cm-draftly-table-cell").nth(6);
    await empty.scrollIntoViewIfNeeded();
    const scroll = await scrollSnapshot(page);
    await empty.click();
    await expectCellCaret(empty, 0, 1);
    await page.keyboard.type("X");
    await expectCellCaret(empty, 1);
    await expectScrollUnchanged(page, scroll);
    expect((await documentSnapshot(page)).rawText).toBe(
      markdown.replace("|  | Neighbor", "| X | Neighbor")
    );
    await page.keyboard.press("Tab");
    const next = page.locator(".cm-draftly-table-cell").nth(7);
    await expectCellCaret(next, 0, 1);
    await page.keyboard.press("ArrowLeft");
    await expectCellCaret(empty, 0, 1);
    await page.keyboard.press("ArrowRight");
    await expectCellCaret(empty, 1);
    await expectScrollUnchanged(page, scroll);
  });
}

for (const bytes of [100_000, 500_000, 1_000_000]) {
  test(`wrapped table caret stays visible without scrolling at ${bytes} bytes`, async ({
    page
  }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (/measure|heightmap|plugin.*threw/i.test(message.text()))
        errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 960, height: 640 });
    await page.goto("/");
    const fixture = markdownFixture(bytes);
    const landmark = "Wrapped-cell regression below this paragraph.";
    const markdown = fixture.replace(
      "## Section 49\n",
      landmark + "\n\n" + tableWhitespaceMarkdown + "\n## Section 49\n"
    );
    await hydrate(page, markdown);
    const cell = page
      .locator(".cm-draftly-table-cell")
      .filter({ hasText: /^Cancelled by card\?/ });
    // Reach the fixture through real scrolling so each viewport is measured before
    // advancing. No source-coordinate jump is used to arrange this geometry test.
    await page.locator(".cm-scroller").hover();
    for (let step = 0; step < 100 && (await cell.count()) === 0; step++) {
      await page.mouse.wheel(0, 500);
      await scrollSnapshot(page);
    }
    await expect(cell).toBeVisible();
    const point = await cellLineEnd(cell);
    const scroll = await scrollSnapshot(page);
    expect(scroll.top).toBeGreaterThan(1000);
    await page.mouse.click(point.x, point.y);
    await expectCellCaret(cell, cancelledCell.length);
    await expectScrollUnchanged(page, scroll);
    for (const [index, character] of Array.from("XYZ").entries()) {
      await page.keyboard.type(character);
      await expectCellCaret(cell, cancelledCell.length + index + 1);
      await expectScrollUnchanged(page, scroll);
    }
    expect((await documentSnapshot(page)).rawText).toBe(
      markdown.replace(cancelledCell, cancelledCell + "XYZ")
    );
    await page.screenshot({ path: testInfo.outputPath("visible-caret.png") });
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+z" : "Control+z"
    );
    expect((await documentSnapshot(page)).rawText).toBe(markdown);
    await expectCellCaret(cell, cancelledCell.length);
    await expectScrollUnchanged(page, scroll);
    // A glyph click after an end-of-cell repair still uses the clicked character.
    const inside = await textPoint(cell, 4);
    await page.mouse.click(inside.x, inside.y);
    await expectCellCaret(cell, 4, 1);
    await expectScrollUnchanged(page, scroll);
    expect(errors).toEqual([]);
  });
}

test("multiple cell-end carets stay visible and typing undoes as one group", async ({
  page
}) => {
  await page.goto("/");
  await hydrate(page, paddedTable);
  const first = page.locator(".cm-draftly-table-cell").nth(3);
  const second = page.locator(".cm-draftly-table-cell").nth(4);
  const firstEnd = await cellLineEnd(first);
  const secondEnd = await cellLineEnd(second);
  await page.mouse.click(firstEnd.x, firstEnd.y);
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.mouse.click(secondEnd.x, secondEnd.y);
  await page.keyboard.up(modifier);
  await expect(page.locator(".cm-cursor")).toHaveCount(2);
  const scroll = await scrollSnapshot(page);
  await expectCellCaret(first, "Left content".length, -1, false);
  await expectCellCaret(second, "Centered content".length);
  await page.keyboard.type("ABC");
  await expectCellCaret(first, "Left contentABC".length, -1, false);
  await expectCellCaret(second, "Centered contentABC".length);
  await expectScrollUnchanged(page, scroll);
  expect((await documentSnapshot(page)).rawText).toBe(
    paddedTable
      .replace("Left content", "Left contentABC")
      .replace("Centered content", "Centered contentABC")
  );
  await page.keyboard.press(`${modifier}+z`);
  expect((await documentSnapshot(page)).rawText).toBe(paddedTable);
  await expectCellCaret(first, "Left content".length, -1, false);
  await expectCellCaret(second, "Centered content".length);
});
