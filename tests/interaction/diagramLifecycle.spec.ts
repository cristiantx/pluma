import { expect, test } from "@playwright/test";
import {
  documentSnapshot,
  hydrate,
  insertAt,
  setSurface
} from "./rendererHarness";

test("diagram failure stays editable and does not corrupt following text", async ({
  page
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const markdown =
    "# Invalid diagram\n\n```mermaid\nnot-a-valid-diagram\n```\n\nFollowing text stays editable.\n";
  await hydrate(page, markdown);
  await expect(page.locator(".cm-draftly-mermaid-error")).toBeVisible();
  await insertAt(
    page,
    page.locator(".cm-line").filter({ hasText: /^Following text/ }),
    10,
    "MARKER "
  );
  const errorButton = page.getByRole("button", {
    name: /Edit Mermaid diagram/
  });
  await errorButton.focus();
  await errorButton.press("Enter");
  await page.keyboard.insertText("%% comment\n");
  expect((await documentSnapshot(page)).rawText).toContain(
    "```mermaid\n%% comment\nnot-a-valid-diagram"
  );
  expect(errors).toEqual([]);
});

test("switching documents while diagrams load discards stale widget output", async ({
  page
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/measure loop|plugin.*threw/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto("/");
  await hydrate(
    page,
    "# Loading\n\n```mermaid\ngraph LR\n" +
      Array.from({ length: 120 }, (_, i) => `A${i} --> A${i + 1}`).join("\n") +
      "\n```\n"
  );
  await setSurface(page, "source");
  const replacement = "# Replacement\n\nReplacement paragraph.\n";
  await hydrate(page, replacement);
  await expect(
    page.locator(".cm-line").filter({ hasText: /^Replacement paragraph/ })
  ).toBeVisible();
  await setSurface(page, "preview");
  await expect(page.locator(".preview-pane")).toContainText(
    "Replacement paragraph."
  );
  await setSurface(page, "rich");
  await expect(page.locator(".cm-draftly-mermaid-rendered")).toHaveCount(0);
  expect((await documentSnapshot(page)).rawText).toBe(replacement);
  expect(errors).toEqual([]);
});
