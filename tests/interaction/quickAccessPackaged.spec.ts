import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  launchPackaged,
  terminatePackaged,
  type PackagedApplication
} from "./packagedHarness";

const run = promisify(execFile);
const executable =
  process.env.PLUMA_PACKAGED_EXECUTABLE ??
  path.resolve(
    "apps/desktop/out/Pluma-darwin-arm64/Pluma.app/Contents/MacOS/Pluma"
  );
async function nativePalette(commands = false) {
  await run("/usr/bin/osascript", [
    "-e",
    'tell application "System Events" to tell process "Pluma" to set frontmost to true',
    "-e",
    `tell application "System Events" to keystroke "p" using {command down${commands ? ", shift down" : ""}}`
  ]);
}

test("packaged native Quick Access shortcuts preserve pending text and load the worker", async () => {
  const testInfo = test.info();
  test.skip(
    process.platform !== "darwin",
    "This native accelerator harness uses macOS System Events."
  );
  expect(
    existsSync(executable),
    "Package Pluma before running this required test"
  ).toBe(true);
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "pluma-quick-packaged-")
  );
  const profile = path.join(directory, "profile");
  const workspace = path.join(directory, "workspace");
  await mkdir(profile);
  await mkdir(workspace);
  const alpha = path.join(workspace, "Alpha.md");
  await writeFile(alpha, "Alpha native text\n");
  await writeFile(path.join(workspace, "Beta.md"), "Beta native text\n");
  await writeFile(
    path.join(profile, "session-state.json"),
    JSON.stringify({
      activeWindowIndex: 0,
      windows: [
        {
          activeDocumentPath: alpha,
          documentPaths: [alpha],
          editorMode: "source",
          workspacePath: workspace
        }
      ]
    })
  );
  let app: PackagedApplication | undefined;
  try {
    app = await launchPackaged(executable, profile, alpha);
    const page = app.page;
    const editor = page.locator(".pluma-source-editor .cm-content");
    await expect(editor).toBeVisible();
    await page.evaluate(() =>
      window.pluma.updateSettings({ autosaveEnabled: false })
    );
    await editor.click();
    const editedText = "Alpha native text\npending native edits\n";
    await page.keyboard.press("Meta+a");
    await page.keyboard.insertText(editedText);
    await nativePalette();
    const files = page.getByRole("combobox", { name: "Search files" });
    await expect(files).toBeFocused();
    await files.fill("Beta");
    await expect(page.getByRole("option", { name: /Beta.md/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("quick-open.png") });
    await files.press("Enter");
    await expect(
      page.getByRole("tab", { name: "Beta.md", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await nativePalette();
    await files.fill("Alpha");
    await expect(page.getByRole("option", { name: /Alpha.md/ })).toBeVisible();
    await files.press("Enter");
    await expect(editor).toContainText("pending native edits");
    await nativePalette(true);
    const commands = page.getByRole("combobox", { name: "Search commands" });
    await expect(commands).toBeFocused();
    await commands.fill(">Save");
    await expect(page.getByRole("option").first()).toHaveAccessibleName(
      /^Save,/
    );
    await page.screenshot({ path: testInfo.outputPath("command-palette.png") });
    await commands.press("Enter");
    await expect.poll(() => readFile(alpha, "utf8")).toBe(editedText);
    await nativePalette();
    await expect(files).toBeFocused();
    await files.press("Escape");
    await expect(editor).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    for (const mode of ["rich", "preview"] as const) {
      await page.evaluate((mode) => window.pluma.setEditorMode(mode), mode);
      const surface = page.locator(
        mode === "rich" ? ".rich-editor .cm-content" : ".preview-pane"
      );
      await expect(surface).toBeVisible();
      await surface.focus();
      await nativePalette();
      await expect(files).toBeFocused();
      await files.fill("Alpha");
      await nativePalette();
      await expect(files).toHaveValue("Alpha");
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await files.press("Escape");
      await expect(surface).toBeFocused();
    }
    await page.evaluate(() => window.pluma.runCommand({ id: "open-settings" }));
    const settings = page.getByRole("tab", { name: /Settings/ });
    await expect(settings).toHaveAttribute("aria-selected", "true");
    await settings.focus();
    await nativePalette();
    await expect(files).toBeFocused();
    await files.press("Escape");
    await expect(settings).toBeFocused();
    await nativePalette(true);
    await expect(commands).toBeFocused();
    await commands.fill(">Close Tab");
    await commands.press("Enter");
    await expect(settings).toHaveCount(0);
  } finally {
    if (app) {
      await app.browser.close();
      await terminatePackaged(app.child);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
