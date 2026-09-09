import path from "node:path";
import { expect, test } from "@playwright/test";
import { addSecondDocument, selectionSnapshot } from "./editorStateHarness";
import {
  documentSnapshot,
  hydrate,
  insertAt,
  setSurface,
  textPoint
} from "./rendererHarness";

const markdown =
  "# State contracts\n\nAlpha beta gamma delta.\n\nNeedle appears here. Needle appears again.\n";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

for (const backwards of [false, true]) {
  test(`${backwards ? "backward" : "forward"} selection survives modes, themes, tabs, settings and preview`, async ({
    page
  }) => {
    await hydrate(page, markdown);
    await addSecondDocument(page);
    const paragraph = page
      .locator(".rich-editor .cm-line")
      .filter({ hasText: /^Alpha beta/ });
    const start = await textPoint(paragraph, backwards ? 16 : 6);
    const end = await textPoint(paragraph, backwards ? 6 : 16);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    const offset = markdown.indexOf("Alpha");
    const expected = {
      anchor: offset + (backwards ? 16 : 6),
      head: offset + (backwards ? 6 : 16),
      text: "beta gamma"
    };
    await expect.poll(() => selectionSnapshot(page)).toEqual(expected);
    for (const surface of ["dark", "light", "source", "rich"] as const) {
      await setSurface(page, surface);
      await expect.poll(() => selectionSnapshot(page)).toEqual(expected);
    }
    await page.getByRole("tab", { name: "Second.md", exact: true }).click();
    await expect(
      page
        .locator(".rich-editor .cm-line")
        .filter({ hasText: "Other document content." })
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Interaction.md", exact: true })
      .click();
    await expect.poll(() => selectionSnapshot(page)).toEqual(expected);
    await setSurface(page, "settings");
    const settingsBounds = await page
      .locator(".settings-view")
      .evaluate((element) => ({
        height: element.clientHeight,
        total: element.scrollHeight,
        windowHeight: window.innerHeight
      }));
    expect(settingsBounds.height).toBeLessThan(settingsBounds.windowHeight);
    expect(settingsBounds.total).toBeGreaterThan(settingsBounds.height);
    await expect(
      page.getByRole("tab", { name: "Settings", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await page
      .getByRole("tab", { name: "Interaction.md", exact: true })
      .click();
    await expect.poll(() => selectionSnapshot(page)).toEqual(expected);
    await setSurface(page, "preview");
    await expect(page.locator("article.preview-pane")).toBeVisible();
    await setSurface(page, "rich");
    await expect.poll(() => selectionSnapshot(page)).toEqual(expected);
    expect(await documentSnapshot(page)).toEqual({
      rawText: markdown,
      saveState: "idle"
    });
  });
}

test("search query and counts survive editor readiness and update after edits", async ({
  page
}) => {
  await hydrate(page, markdown);
  await page.locator(".rich-editor .cm-content").focus();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("pluma:editor-command", { detail: "find" })
    )
  );
  const find = page.getByRole("textbox", { name: "Find", exact: true });
  await find.fill("Needle");
  await expect(page.locator(".pluma-search-count")).toHaveText(/\d of 2/);
  await setSurface(page, "source");
  await expect(page.locator(".source-pane .cm-content")).toBeVisible();
  await expect(find).toHaveValue("Needle");
  await expect(page.locator(".pluma-search-count")).toHaveText(/\d of 2/);
  await setSurface(page, "rich");
  await expect(find).toHaveValue("Needle");
  await expect(page.locator(".pluma-search-count")).toHaveText(/\d of 2/);
  await insertAt(
    page,
    page.locator(".rich-editor .cm-line").filter({ hasText: /^Alpha beta/ }),
    0,
    "Needle "
  );
  await expect(page.locator(".pluma-search-count")).toHaveText(/\d of 3/);
  await find.focus();
  await find.press("Escape");
  await expect(find).toBeHidden();
  await expect(page.locator(".rich-editor .cm-content")).toBeFocused();
});

test("native table buttons add one row with Space and one column with Enter", async ({
  page
}) => {
  await hydrate(
    page,
    "# Table\n\n| Name | Value |\n| --- | --- |\n| Alpha | Beta |\n\nAfter table.\n"
  );
  const addRow = page.getByRole("button", { name: "Add row", exact: true });
  await addRow.focus();
  await expect(addRow).toBeFocused();
  await addRow.press("Space");
  await expect
    .poll(
      async () =>
        (await documentSnapshot(page)).rawText
          .split("\n")
          .filter((line) => line.startsWith("|")).length
    )
    .toBe(4);
  const addColumn = page.getByRole("button", {
    name: "Add column",
    exact: true
  });
  await addColumn.focus();
  await expect(addColumn).toBeFocused();
  await addColumn.press("Enter");
  await expect
    .poll(async () =>
      (await documentSnapshot(page)).rawText
        .split("\n")
        .filter((line) => line.startsWith("|"))
        .map((line) => line.split("|").length - 1)
    )
    .toEqual([4, 4, 4, 4]);
  expect((await documentSnapshot(page)).rawText).toContain("After table.");
});

test("math renders with local fonts in rich and preview without dirtying source", async ({
  page
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/KaTeX.*\.(woff2?|ttf)(\?|$)/i.test(request.url()))
      requests.push(request.url());
  });
  const source =
    "# Equations\n\nInline $x^2 + y^2 = z^2$ formula.\n\n$$\n\\sum_{n=1}^{10} n = 55\n$$\n";
  await hydrate(page, source);
  await expect(page.locator(".rich-editor .katex").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check('16px "KaTeX_Main"'))
  ).toBe(true);
  await setSurface(page, "preview");
  await expect(page.locator(".preview-pane .katex").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(requests.length).toBeGreaterThan(0);
  expect(
    requests.every((url) => new URL(url).origin === "http://127.0.0.1:4179")
  ).toBe(true);
  expect(await documentSnapshot(page)).toEqual({
    rawText: source,
    saveState: "idle"
  });
});

test("successful same-text reload starts a new undo baseline", async ({
  page
}) => {
  await hydrate(page, markdown);
  await insertAt(
    page,
    page.locator(".cm-line").filter({ hasText: /^Alpha beta/ }),
    6,
    "SAVED "
  );
  const saved = (await documentSnapshot(page)).rawText;
  await page.evaluate(
    async (url) => {
      const { usePlumaStore } = await import(/* @vite-ignore */ url);
      usePlumaStore
        .getState()
        .resetEditorBaseline(
          usePlumaStore.getState().document.activeDocument.id
        );
    },
    `/@fs/${path.resolve("packages/ui/src/index.ts")}`
  );
  await page.locator(".cm-content").focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+z" : "Control+z"
  );
  expect((await documentSnapshot(page)).rawText).toBe(saved);
  await setSurface(page, "source");
  await setSurface(page, "rich");
  await page.locator(".rich-editor .cm-content").focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+z" : "Control+z"
  );
  expect((await documentSnapshot(page)).rawText).toBe(saved);
});
