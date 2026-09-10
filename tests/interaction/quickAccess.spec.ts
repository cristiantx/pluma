import { expect, test } from "@playwright/test";
import {
  hydrateQuickAccess,
  quickAccessSnapshot,
  selectQuickAccessText
} from "./fixtures/quickAccess/renderer.js";
import { editorSnapshot, setSurface } from "./rendererHarness.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await hydrateQuickAccess(page);
});

test("Quick Open matches paths and activates the existing duplicate document once", async ({
  page
}) => {
  const before = await quickAccessSnapshot(page);
  await page.keyboard.press("Meta+p");
  const input = page.getByRole("combobox", { name: "Search files" });
  await expect(input).toBeFocused();
  await input.fill("arch/mtng");
  const row = page.getByRole("option", { name: /archive\/Meeting.md/ });
  await expect(row).toBeVisible();
  expect((await quickAccessSnapshot(page)).activeId).toBe(before.activeId);
  await input.press("ArrowDown");
  expect((await quickAccessSnapshot(page)).calls).toEqual([]);
  await input.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => (await quickAccessSnapshot(page)).rawText)
    .toBe("Archived meeting content.\n");
  expect((await quickAccessSnapshot(page)).calls).toEqual([
    "activate:open-document"
  ]);
});

test("Escape preserves the editor text, selection, and focus", async ({
  page
}) => {
  const editor = page.locator(".rich-editor .cm-content[contenteditable=true]");
  await selectQuickAccessText(page);
  const before = await editorSnapshot(page);
  expect(before.selectedText.length).toBeGreaterThan(0);
  await page.keyboard.press("Meta+p");
  await page.getByRole("combobox").fill("Meeting");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(editor).toBeFocused();
  expect(await editorSnapshot(page)).toEqual(before);
  expect((await quickAccessSnapshot(page)).calls).toEqual([]);
});

test("Preview formatting remains discoverable but cannot execute", async ({
  page
}) => {
  await setSurface(page, "preview");
  await page.keyboard.press("Meta+Shift+p");
  const input = page.getByRole("combobox", { name: "Search commands" });
  await input.fill(">Bold");
  const row = page.getByRole("option", { name: /Bold/ });
  await expect(row).toHaveAttribute("aria-disabled", "true");
  await input.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await quickAccessSnapshot(page)).calls).toEqual([]);
});

test("the command prefix switches modes and restores the file query", async ({
  page
}) => {
  await page.keyboard.press("Meta+p");
  await page.getByRole("combobox").fill("Meeting");
  await page.getByRole("button", { name: "Switch to commands" }).click();
  await expect(page.getByRole("combobox")).toHaveValue(">");
  await page.getByRole("combobox").fill("");
  await expect(
    page.getByRole("combobox", { name: "Search files" })
  ).toHaveValue("Meeting");
  await page.getByRole("combobox").fill(">Bold");
  await expect(
    page.getByRole("combobox", { name: "Search commands" })
  ).toHaveValue(">Bold");
});

test("without a workspace open actions remain available beside unsaved documents", async ({
  page
}) => {
  await hydrateQuickAccess(page, false);
  await page.keyboard.press("Meta+p");
  await expect(
    page.getByRole("option", { name: /Unsaved document/ })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open File…", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Folder…", exact: true }).click();
  await expect
    .poll(async () => (await quickAccessSnapshot(page)).calls)
    .toEqual(["command:open-folder"]);
});

test("repeated Enter submits a selected document exactly once", async ({
  page
}) => {
  await page.keyboard.press("Meta+p");
  const input = page.getByRole("combobox");
  await input.fill("archive");
  await expect(page.getByRole("option")).toHaveCount(1);
  await input.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        repeat: true
      })
    );
  });
  await expect
    .poll(async () => (await quickAccessSnapshot(page)).calls)
    .toEqual(["activate:open-document"]);
});

test("Bold executes through the retained editor selection after flushing", async ({
  page
}) => {
  await selectQuickAccessText(page);
  const before = await editorSnapshot(page);
  expect(before.selectedText.length).toBeGreaterThan(0);
  await page.locator('[role="tab"][aria-selected="true"]').focus();
  await page.keyboard.press("Meta+Shift+p");
  await page.getByRole("combobox").fill(">Bold");
  await expect(page.getByRole("option", { name: /Bold/ })).not.toHaveAttribute(
    "aria-disabled",
    "true"
  );
  await page.getByRole("combobox").press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => (await quickAccessSnapshot(page)).rawText)
    .toContain(`**${before.selectedText}**`);
  expect((await quickAccessSnapshot(page)).calls).toEqual(["flush"]);
  await expect(
    page.locator(".rich-editor .cm-content[contenteditable=true]")
  ).toBeFocused();
});
