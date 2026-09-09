import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  launchPackaged,
  nativeCommand,
  nativeWindowSize,
  terminatePackaged,
  type PackagedApplication
} from "./packagedHarness";
import { markdownFixture } from "./markdownFixture";
import { textPoint } from "./rendererHarness";
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

const executable =
  process.env.PLUMA_PACKAGED_EXECUTABLE ??
  path.resolve(
    "apps/desktop/out/Pluma-darwin-arm64/Pluma.app/Contents/MacOS/Pluma"
  );

for (const dimensions of [
  { width: 960, height: 640 },
  { width: 1280, height: 820 }
]) {
  test(`packaged native file, save, undo, search and theme at ${dimensions.width}x${dimensions.height}`, async () => {
    test.skip(
      !existsSync(executable),
      "Package Pluma first or set PLUMA_PACKAGED_EXECUTABLE"
    );
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "pluma-packaged-interaction-")
    );
    const profile = path.join(directory, "profile");
    const filePath = path.join(directory, "Native interaction.md");
    const source =
      "# Native interaction\n\n| Key | Description |\n| --- | --- |\n| TargetCell | Native pointer insertion target. |\n\nAfter table is editable.\n\nInline $x^2 + y^2$ formula.\n\n" +
      "Paragraph before the wrapped table.\n\n".repeat(12) +
      tableWhitespaceMarkdown +
      "\n" +
      markdownFixture();
    await writeFile(filePath, source);
    let application: PackagedApplication | undefined;
    try {
      application = await launchPackaged(executable, profile, filePath);
      const { page } = application;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      expect(page.url()).toMatch(/^file:\/\//);
      await expect
        .poll(() =>
          page.evaluate(
            () => typeof (window as unknown as { pluma?: unknown }).pluma
          )
        )
        .toBe("object");
      await nativeWindowSize(page, dimensions.width, dimensions.height);
      await expect(
        page.getByRole("tab", { name: "Native interaction.md", exact: true })
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Rich view", exact: true })
        .click();
      const cell = page
        .locator(".rich-editor .cm-draftly-table-cell")
        .filter({ hasText: /^TargetCell$/ });
      await expect(cell).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await readFile(filePath, "utf8")).toBe(source);
      const point = await textPoint(cell, 6);
      await page.mouse.click(point.x, point.y);
      await page.keyboard.insertText("PACKAGED");
      await nativeCommand(page, "save");
      const expected = source.replace("TargetCell", "TargetPACKAGEDCell");
      await expect.poll(() => readFile(filePath, "utf8")).toBe(expected);
      await page.locator(".rich-editor .cm-content").focus();
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+z" : "Control+z"
      );
      await expect(cell).toHaveText("TargetCell");
      await nativeCommand(page, "save");
      await expect.poll(() => readFile(filePath, "utf8")).toBe(source);
      await nativeWindowSize(page, 960, dimensions.height);
      const wrapped = page
        .locator(".cm-draftly-table-body-row .cm-draftly-table-cell")
        .filter({ hasText: /^Cancelled by card\?/ });
      await page.locator(".cm-scroller").hover();
      for (let step = 0; step < 10 && (await wrapped.count()) === 0; step++) {
        await page.mouse.wheel(0, 500);
        await scrollSnapshot(page);
      }
      await wrapped.evaluate((element) =>
        element.scrollIntoView({ block: "center" })
      );
      const blank = await cellLineEnd(wrapped);
      expectWrappedBlankSpace(blank);
      const scrollBefore = await scrollSnapshot(page);
      expect(scrollBefore.top).toBeGreaterThan(0);
      await page.mouse.click(blank.x, blank.y);
      await expectCellCaret(wrapped, cancelledCell.length);
      await expectScrollUnchanged(page, scrollBefore);
      await page.keyboard.insertText("FINAL_LINE");
      await expectCellCaret(
        wrapped,
        cancelledCell.length + "FINAL_LINE".length
      );
      await expectScrollUnchanged(page, scrollBefore);
      await nativeCommand(page, "save");
      await expect
        .poll(() => readFile(filePath, "utf8"))
        .toBe(source.replace(cancelledCell, cancelledCell + "FINAL_LINE"));
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+z" : "Control+z"
      );
      await expect(wrapped).toHaveText(cancelledCell);
      await nativeCommand(page, "save");
      await expect.poll(() => readFile(filePath, "utf8")).toBe(source);
      await nativeWindowSize(page, dimensions.width, dimensions.height);
      const afterDiagram = page
        .locator(".rich-editor .cm-line")
        .filter({ hasText: /^After diagram 1 / });
      await afterDiagram.scrollIntoViewIfNeeded();
      await expect(
        page.locator(".cm-draftly-mermaid-rendered svg").first()
      ).toBeVisible();
      const diagramPoint = await textPoint(afterDiagram, 6);
      await page.mouse.click(diagramPoint.x, diagramPoint.y);
      await page.keyboard.insertText("NATIVE_DIAGRAM_");
      await nativeCommand(page, "save");
      await expect
        .poll(() => readFile(filePath, "utf8"))
        .toBe(
          source.replace("After diagram 1", "After NATIVE_DIAGRAM_diagram 1")
        );
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+z" : "Control+z"
      );
      await nativeCommand(page, "save");
      await expect.poll(() => readFile(filePath, "utf8")).toBe(source);
      await nativeCommand(page, "find");
      const find = page.getByRole("textbox", { name: "Find", exact: true });
      await expect(find).toBeFocused();
      await find.fill("TargetCell");
      await expect(page.locator(".pluma-search-count")).toHaveText("1 of 1");
      await find.press("Escape");
      await expect(find).toBeHidden();
      await expect(page.locator(".rich-editor .cm-content")).toBeFocused();
      await page.evaluate(async () => {
        const bridge = (
          window as unknown as {
            pluma: {
              updateSettings(settings: {
                themePreference: "dark";
              }): Promise<unknown>;
            };
          }
        ).pluma;
        await bridge.updateSettings({ themePreference: "dark" });
      });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page
        .getByRole("button", { name: "Preview view", exact: true })
        .click();
      await expect(page.locator(".preview-pane .katex").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.fonts.check('16px "KaTeX_Main"'))
      ).toBe(true);
      expect(await readFile(filePath, "utf8")).toBe(source);
      expect(errors).toEqual([]);
    } finally {
      if (application) {
        await application.browser.close().catch(() => {});
        await terminatePackaged(application.child);
      }
      await rm(directory, { recursive: true, force: true });
    }
  });
}
