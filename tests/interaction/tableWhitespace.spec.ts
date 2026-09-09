import { expect, test } from "@playwright/test";
import {
  documentSnapshot,
  hydrate,
  setSurface,
  textPoint
} from "./rendererHarness";
import { selectionSnapshot } from "./editorStateHarness";
import {
  expectCellCaret,
  expectScrollUnchanged,
  scrollSnapshot
} from "./tableCaretHarness";
import {
  cancelledCell,
  cellLineEnd,
  expectWrappedBlankSpace,
  tableWhitespaceMarkdown
} from "./tableWhitespaceHarness";

for (const theme of ["light", "dark"] as const) {
  test(`blank space after a wrapped cell selects its last line in ${theme}`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize({ width: 960, height: 820 });
    await page.goto("/");
    await hydrate(page, tableWhitespaceMarkdown);
    await setSurface(page, theme);
    const cell = page
      .locator(".cm-draftly-table-body-row .cm-draftly-table-cell")
      .first();
    const point = await cellLineEnd(cell);
    expectWrappedBlankSpace(point);
    const scroll = await scrollSnapshot(page);
    await page.mouse.click(point.x, point.y);
    await expectCellCaret(cell, cancelledCell.length);
    await expectScrollUnchanged(page, scroll);
    const expected =
      tableWhitespaceMarkdown.indexOf(cancelledCell) + cancelledCell.length;
    await page.screenshot({
      path: testInfo.outputPath("blank-space-click.png")
    });
    await expect
      .poll(async () => (await selectionSnapshot(page)).head)
      .toBe(expected);
    await page.keyboard.insertText("MARKER");
    expect((await documentSnapshot(page)).rawText).toBe(
      tableWhitespaceMarkdown.replace(cancelledCell, cancelledCell + "MARKER")
    );
    await expectCellCaret(cell, cancelledCell.length + "MARKER".length);
    await expectScrollUnchanged(page, scroll);
  });
}

test("wrapped cell line ends and bottom padding keep the clicked visual line", async ({
  page
}) => {
  await page.setViewportSize({ width: 960, height: 640 });
  await page.goto("/");
  const markdown =
    "Paragraph before the table.\n\n".repeat(8) + tableWhitespaceMarkdown;
  await hydrate(page, markdown);
  const cell = page
    .locator(".cm-draftly-table-body-row .cm-draftly-table-cell")
    .first();
  const first = await cellLineEnd(cell, 0);
  await page.mouse.click(first.x, first.y);
  await expectCellCaret(cell, first.end);
  const from = markdown.indexOf(cancelledCell);
  await expect
    .poll(async () => (await selectionSnapshot(page)).head)
    .toBe(from + first.end);
  const last = await cellLineEnd(cell);
  expectWrappedBlankSpace(last);
  expect(
    await page.locator(".cm-scroller").evaluate((element) => element.scrollTop)
  ).toBeGreaterThan(0);
  const scroll = await scrollSnapshot(page);
  await page.mouse.click(last.x, last.bottomY);
  await expectCellCaret(cell, cancelledCell.length);
  await expectScrollUnchanged(page, scroll);
  await expect
    .poll(async () => (await selectionSnapshot(page)).head)
    .toBe(from + cancelledCell.length);
  await page.keyboard.insertText("BOTTOM");
  expect((await documentSnapshot(page)).rawText).toBe(
    markdown.replace(cancelledCell, cancelledCell + "BOTTOM")
  );
  await expectCellCaret(cell, cancelledCell.length + "BOTTOM".length);
  await expectScrollUnchanged(page, scroll);
});

for (const gesture of ["drag", "shift-click"] as const) {
  test(`${gesture} into wrapped-cell blank space selects through the final character`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 960, height: 820 });
    await page.goto("/");
    await hydrate(page, tableWhitespaceMarkdown);
    const cell = page
      .locator(".cm-draftly-table-body-row .cm-draftly-table-cell")
      .first();
    const start = await textPoint(cell, 4);
    const end = await cellLineEnd(cell);
    expectWrappedBlankSpace(end);
    if (gesture === "drag") {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 8 });
      await page.mouse.up();
    } else {
      await page.mouse.click(start.x, start.y);
      await page.keyboard.down("Shift");
      await page.mouse.click(end.x, end.y);
      await page.keyboard.up("Shift");
    }
    await expect
      .poll(async () => (await selectionSnapshot(page)).text)
      .toBe(cancelledCell.slice(4));
    await page.keyboard.insertText("SELECTED");
    expect((await documentSnapshot(page)).rawText).toBe(
      tableWhitespaceMarkdown.replace(
        cancelledCell,
        cancelledCell.slice(0, 4) + "SELECTED"
      )
    );
  });
}

test("blank space after an explicit cell line break places the caret after its final text", async ({
  page
}) => {
  await page.setViewportSize({ width: 960, height: 820 });
  await page.goto("/");
  const content = "Cancelled by<br />card?";
  const markdown = tableWhitespaceMarkdown.replace(cancelledCell, content);
  await hydrate(page, markdown);
  const cell = page
    .locator(".cm-draftly-table-body-row .cm-draftly-table-cell")
    .first();
  const end = await cellLineEnd(cell);
  expectWrappedBlankSpace(end);
  const scroll = await scrollSnapshot(page);
  await page.mouse.click(end.x, end.y);
  const visibleLength = (await cell.textContent())!.length;
  await expectCellCaret(cell, visibleLength);
  await page.keyboard.insertText("BREAK");
  expect((await documentSnapshot(page)).rawText).toBe(
    markdown.replace(content, content + "BREAK")
  );
  await expectCellCaret(cell, visibleLength + "BREAK".length);
  await expectScrollUnchanged(page, scroll);
});
