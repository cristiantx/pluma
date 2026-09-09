import { expect, test } from "@playwright/test";
import { markdownFixture } from "./markdownFixture";
import {
  documentSnapshot,
  editorSnapshot,
  hydrate,
  insertAt,
  setSurface,
  textPoint
} from "./rendererHarness";

const modifier = process.platform === "darwin" ? "Meta" : "Control";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

for (const bytes of [66_000, 100_000, 500_000, 1_000_000]) {
  test(`opens ${bytes} bytes without changing Markdown or dirty state`, async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const markdown = markdownFixture(bytes);
    await hydrate(page, markdown);
    await expect(
      page.locator(".rich-editor .cm-line").filter({ hasText: /^Paragraph 1 / })
    ).toBeVisible();
    expect((await editorSnapshot(page)).rawText).toBe(markdown);
    expect(await documentSnapshot(page)).toEqual({
      rawText: markdown,
      saveState: "idle"
    });
    expect(errors).toEqual([]);
  });
}

test("pointer insertion follows cell and wrapped text geometry", async ({
  page
}) => {
  await hydrate(page, markdownFixture());
  await insertAt(
    page,
    page
      .locator(".rich-editor .cm-draftly-table-cell")
      .filter({ hasText: /^Cell1$/ }),
    3,
    "CELL_INSERT"
  );
  await insertAt(
    page,
    page
      .locator(".rich-editor .cm-draftly-table-cell")
      .filter({ hasText: /^Wrapped cell 1 / }),
    110,
    "WRAPPED_INSERT"
  );
  await insertAt(
    page,
    page
      .locator(".rich-editor .cm-line")
      .filter({ hasText: /^After diagram 1 / }),
    19,
    "AFTER_INSERT"
  );
});

test("double click and Shift selection replace exactly the selected text", async ({
  page
}) => {
  await hydrate(page, markdownFixture());
  const paragraph = page
    .locator(".rich-editor .cm-line")
    .filter({ hasText: /^(Paragraph|Selected|Replaced) 1 / });
  const point = await textPoint(paragraph, 3);
  await page.mouse.dblclick(point.x, point.y);
  await expect
    .poll(async () => (await editorSnapshot(page)).selectedText)
    .toBe("Paragraph");
  await page.keyboard.insertText("Selected");
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .toContain("Selected 1 has an independent");
  const start = await textPoint(paragraph, 0);
  const end = await textPoint(paragraph, 8);
  await page.mouse.click(start.x, start.y);
  await page.keyboard.down("Shift");
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await editorSnapshot(page)).selectedText)
    .toBe("Selected");
  await page.keyboard.insertText("Replaced");
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .toContain("Replaced 1 has an independent");
});

test("history and document text survive theme and surface changes", async ({
  page
}) => {
  await hydrate(page, markdownFixture());
  await insertAt(
    page,
    page.locator(".rich-editor .cm-line").filter({ hasText: /^Paragraph 1 / }),
    10,
    "HISTORY_MARKER"
  );
  await page.keyboard.press(`${modifier}+z`);
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .not.toContain("HISTORY_MARKER");
  await page.keyboard.press(`${modifier}+Shift+z`);
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .toContain("HISTORY_MARKER");
  const edited = (await documentSnapshot(page)).rawText;
  for (const surface of [
    "dark",
    "light",
    "source",
    "preview",
    "settings",
    "rich"
  ] as const) {
    await setSurface(page, surface);
    if (surface === "source")
      await expect(page.locator(".cm-editor")).toBeVisible();
    if (surface === "preview")
      await expect(page.locator("article.preview-pane")).toBeVisible();
    if (surface === "rich")
      await expect(page.locator(".rich-editor .cm-content")).toBeVisible();
    expect((await documentSnapshot(page)).rawText).toBe(edited);
  }
  await page.locator(".rich-editor .cm-content").focus();
  await page.keyboard.press(`${modifier}+z`);
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .not.toContain("HISTORY_MARKER");
});

test("search Escape restores editor focus", async ({ page }) => {
  await hydrate(page, markdownFixture());
  await page.locator(".rich-editor .cm-content").focus();
  // Electron menu accelerators forward this command to the renderer.
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("pluma:editor-command", { detail: "find" })
    )
  );
  const find = page.getByRole("textbox", { name: "Find", exact: true });
  await expect(find).toBeFocused();
  await find.fill("Paragraph");
  await find.press("Enter");
  await expect(find).toBeFocused();
  await find.press("Escape");
  await expect(find).toBeHidden();
  await expect(page.locator(".rich-editor .cm-content")).toBeFocused();
});

test("table cell padding clicks insert in that cell", async ({ page }) => {
  await hydrate(page, markdownFixture());
  const cell = page
    .locator(".rich-editor .cm-draftly-table-cell")
    .filter({ hasText: /^Cell1$/ });
  await cell.scrollIntoViewIfNeeded();
  const box = await cell.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + 2, box!.y + box!.height / 2);
  await page.keyboard.insertText("PADDING");
  await expect
    .poll(async () =>
      /\| PADDINGCell1\s*\|/.test((await documentSnapshot(page)).rawText)
    )
    .toBe(true);
});

test("tabs support keyboard navigation to settings and back", async ({
  page
}) => {
  await hydrate(page, markdownFixture());
  await setSurface(page, "settings");
  const settings = page.getByRole("tab", { name: "Settings", exact: true });
  await settings.focus();
  await settings.press("ArrowLeft");
  const documentTab = page.getByRole("tab", {
    name: "Interaction.md",
    exact: true
  });
  await expect(documentTab).toBeFocused();
  await expect(documentTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".rich-editor .cm-content")).toBeVisible();
  await documentTab.press("End");
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute("aria-selected", "true");
});
