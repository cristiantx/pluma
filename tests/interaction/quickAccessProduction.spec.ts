import { expect, test } from "@playwright/test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  launchProduction,
  clickApplicationMenuItem,
  forceCloseProduction,
  runRendererCommand,
  setRendererMode,
  type ProductionApplication
} from "./productionHarness";

test("Quick Open and palette preserve pending edits through real main/preload saves", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "pluma-quick-production-")
  );
  const workspace = path.join(directory, "workspace");
  await mkdir(workspace);
  const alpha = path.join(workspace, "Alpha.md");
  await writeFile(alpha, "Alpha text\n");
  await writeFile(path.join(workspace, "Beta.md"), "Beta text\n");
  let app: ProductionApplication | undefined;
  try {
    app = await launchProduction(path.join(directory, "profile"), alpha);
    const page = app.firstPage;
    await app.application.evaluate(({ dialog }, workspace) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [workspace]
      });
    }, workspace);
    await runRendererCommand(page, "open-folder");
    await page.evaluate(async (alpha) => {
      await window.pluma.openWorkspaceFile(alpha);
      await window.pluma.updateSettings({ autosaveEnabled: false });
    }, alpha);
    await setRendererMode(page, "source");
    const editor = page.locator(".pluma-source-editor .cm-content");
    await editor.click();
    await page.keyboard.press("Meta+End");
    await page.keyboard.insertText("pending quick access");
    await clickApplicationMenuItem(app.application, "Quick Open");
    const input = page.getByRole("combobox", { name: "Search files" });
    await expect(input).toBeFocused();
    await input.fill("Beta");
    await expect(page.getByRole("option", { name: /Beta.md/ })).toBeVisible();
    await input.press("Enter");
    await expect(
      page.getByRole("tab", { name: "Beta.md", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await clickApplicationMenuItem(app.application, "Quick Open");
    await input.fill("Alpha");
    await expect(page.getByRole("option", { name: /Alpha.md/ })).toBeVisible();
    await input.press("Enter");
    await expect(editor).toContainText("pending quick access");
    await clickApplicationMenuItem(app.application, "Command Palette");
    const commands = page.getByRole("combobox", { name: "Search commands" });
    await expect(commands).toBeFocused();
    await commands.fill(">Save");
    await commands.press("Enter");
    await expect
      .poll(() => readFile(alpha, "utf8"))
      .toContain("pending quick access");
    await expect(
      page.getByRole("dialog", { name: "Command palette" })
    ).toHaveCount(0);
    // Save As cancellation is an explicit result and retains document contents.
    await app.application.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({
        canceled: true,
        filePath: undefined
      });
    });
    await clickApplicationMenuItem(app.application, "Command Palette");
    await commands.fill(">Save As");
    await commands.press("Enter");
    await expect(commands).toHaveCount(0);
    await expect(editor).toContainText("pending quick access");
    // An unavailable captured document cannot execute against the current one.
    const stale = await page.evaluate(() =>
      window.pluma.runCommand({
        request: { id: "save" },
        context: {
          activeTabId: "gone",
          documentId: "gone",
          workspaceGeneration: 0
        }
      })
    );
    expect(stale.status).toBe("unavailable");
    await runRendererCommand(page, "open-settings");
    await clickApplicationMenuItem(app.application, "Command Palette");
    await commands.fill(">Close Tab");
    await commands.press("Enter");
    await expect(page.getByRole("tab", { name: /Settings/ })).toHaveCount(0);
  } finally {
    if (app) await forceCloseProduction(app.application);
    await rm(directory, { recursive: true, force: true });
  }
});
