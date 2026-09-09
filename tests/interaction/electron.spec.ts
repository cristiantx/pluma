import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { markdownFixture } from "./markdownFixture";
import {
  documentSnapshot,
  hydrate,
  insertAt,
  textPoint
} from "./rendererHarness";
import { selectionSnapshot } from "./editorStateHarness";
import {
  cancelledCell,
  cellLineEnd,
  expectWrappedBlankSpace,
  tableWhitespaceMarkdown
} from "./tableWhitespaceHarness";

const require = createRequire(path.resolve("package.json"));

test("Electron context isolation, clean open, and real pointer insertion", async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), "pluma-interaction-"));
  const application = await electron.launch({
    executablePath: require("electron") as string,
    args: [path.resolve("tests/interaction/electronHarness.cjs")],
    env: {
      ...process.env,
      PLUMA_TEST_USER_DATA: userData,
      PLUMA_TEST_RENDERER_URL: "http://127.0.0.1:4179"
    }
  });
  try {
    const page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    expect(
      await application.evaluate(({ app }) => app.getPath("userData"))
    ).toBe(userData);
    const markdown = markdownFixture();
    await hydrate(page, markdown);
    expect(await documentSnapshot(page)).toEqual({
      rawText: markdown,
      saveState: "idle"
    });
    await insertAt(
      page,
      page
        .locator(".rich-editor .cm-draftly-table-cell")
        .filter({ hasText: /^Cell1$/ }),
      2,
      "ELECTRON"
    );
    const cell = page
      .locator(".cm-draftly-table-cell")
      .filter({ hasText: /^CeELECTRONll1$/ });
    const start = await textPoint(cell, 2);
    const end = await textPoint(cell, 10);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () => (await selectionSnapshot(page)).text)
      .toBe("ELECTRON");
    const highlight = page.locator(
      ".pluma-rich-selection-layer .cm-selectionBackground"
    );
    await expect(highlight).toBeVisible();
    const bounds = (await highlight.boundingBox())!;
    expect(Math.abs(bounds.x - start.x)).toBeLessThan(2);
    expect(Math.abs(bounds.x + bounds.width - end.x)).toBeLessThan(2);
    await page.keyboard.insertText("NATIVE");
    expect((await documentSnapshot(page)).rawText).toContain("CeNATIVEll1");
    await hydrate(
      page,
      "10. Native numbered list\n100. Three-digit list item\n"
    );
    await expect(page.locator(".cm-draftly-list-mark-ol")).toHaveCount(2);
    for (const marker of await page.locator(".cm-draftly-list-mark-ol").all()) {
      const sizes = await marker.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          box: element.getBoundingClientRect().width,
          text: range.getBoundingClientRect().width
        };
      });
      expect(sizes.box).toBeGreaterThanOrEqual(sizes.text - 0.5);
    }
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setContentSize(960, 820);
    });
    await hydrate(page, tableWhitespaceMarkdown);
    const wrapped = page
      .locator(".cm-draftly-table-body-row .cm-draftly-table-cell")
      .first();
    const blank = await cellLineEnd(wrapped);
    expectWrappedBlankSpace(blank);
    await page.mouse.click(blank.x, blank.y);
    await page.keyboard.insertText("FINAL_LINE");
    expect((await documentSnapshot(page)).rawText).toBe(
      tableWhitespaceMarkdown.replace(
        cancelledCell,
        cancelledCell + "FINAL_LINE"
      )
    );
    expect(errors).toEqual([]);
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true });
  }
});
