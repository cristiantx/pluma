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
    expect(errors).toEqual([]);
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true });
  }
});
