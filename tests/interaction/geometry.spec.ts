import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { markdownFixture } from "./markdownFixture";
import {
  documentSnapshot,
  hydrate,
  insertAt,
  setSurface,
  textPoint
} from "./rendererHarness";

async function scrollToSource(page: Page, text: string) {
  await page.evaluate(
    async ({ url, text }) => {
      const served = await (await fetch(url)).text();
      const moduleUrl = served.match(
        /import\s*\{\s*EditorView\s*\}\s*from\s*["']([^"']+)["']/
      )![1];
      const { EditorView } = await import(/* @vite-ignore */ moduleUrl);
      const view = EditorView.findFromDOM(document.querySelector(".cm-editor"));
      const position = view.state.doc.toString().indexOf(text);
      if (position < 0) throw new Error(`Missing source target ${text}`);
      view.dispatch({
        effects: EditorView.scrollIntoView(position, { y: "center" })
      });
    },
    {
      url: `/@fs/${path.resolve("packages/editor/src/sourceEditorInterop.ts")}`,
      text
    }
  );
}

for (const bytes of [100_000, 500_000, 1_000_000]) {
  test(`precise deep-scroll insertion at ${bytes} bytes`, async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (/measure|heightmap|plugin.*threw/i.test(message.text()))
        warnings.push(message.text());
    });
    page.on("pageerror", (error) => warnings.push(error.message));
    await page.goto("/");
    await hydrate(page, markdownFixture(bytes));
    await scrollToSource(page, "After diagram 48 remains");
    const paragraph = page
      .locator(".rich-editor .cm-line")
      .filter({ hasText: /^After diagram 48 / });
    await expect(paragraph).toBeVisible();
    await expect(
      page.locator(".cm-draftly-mermaid-rendered svg").first()
    ).toBeVisible();
    const point = await textPoint(paragraph, 20);
    const before = await page
      .locator(".cm-scroller")
      .evaluate((element) => element.scrollTop);
    await page.mouse.click(point.x, point.y);
    const after = await page
      .locator(".cm-scroller")
      .evaluate((element) => element.scrollTop);
    expect(Math.abs(after - before)).toBeLessThan(32);
    await insertAt(page, paragraph, 20, "DEEP_MARKER");
    await scrollToSource(page, "Final insertion target");
    await insertAt(
      page,
      page.locator(".cm-line").filter({ hasText: /^Final insertion target/ }),
      6,
      "END_MARKER"
    );
    expect(warnings).toEqual([]);
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const size of [
    { width: 960, height: 640 },
    { width: 1280, height: 820 }
  ]) {
    test(`diagram activation and geometry ${theme} ${size.width}`, async ({
      page
    }, testInfo) => {
      await page.setViewportSize(size);
      await page.goto("/");
      const markdown = markdownFixture();
      await hydrate(page, markdown);
      await setSurface(page, theme);
      const diagram = page
        .getByRole("button", { name: /Edit Mermaid diagram/ })
        .first();
      await expect(diagram.locator("svg")).toBeVisible();
      const dimensions = await diagram.locator("svg").evaluate((svg) => ({
        width: svg.getBoundingClientRect().width,
        intrinsic: (svg as SVGSVGElement).viewBox.baseVal.width
      }));
      expect(dimensions.width).toBeLessThanOrEqual(dimensions.intrinsic + 1);
      await diagram.click();
      await page.keyboard.insertText("%% source marker\n");
      expect((await documentSnapshot(page)).rawText).toBe(
        markdown.replace("```mermaid\n", "```mermaid\n%% source marker\n")
      );
      await page.screenshot({
        path: testInfo.outputPath("desktop-editor.png")
      });
    });
  }
}

test("empty cells, word selection and table drag gestures preserve source boundaries", async ({
  page
}) => {
  await page.goto("/");
  const markdown =
    "# Gestures\n\n| Name | Description |\n| --- | --- |\n| Alpha bravo | Charlie delta echo |\n|  | empty neighbor |\n\nAfter table.\n";
  await hydrate(page, markdown);
  const empty = page
    .locator(".cm-draftly-table-cell")
    .filter({ hasText: /^\s*$/ });
  await empty.click();
  await page.keyboard.insertText("EMPTY");
  expect((await documentSnapshot(page)).rawText).toBe(
    markdown.replace("|  | empty", "| EMPTY | empty")
  );
  const cell = page
    .locator(".cm-draftly-table-cell")
    .filter({ hasText: /^Alpha bravo$/ });
  const word = await textPoint(cell, 3);
  await page.mouse.dblclick(word.x, word.y);
  await page.keyboard.insertText("Word");
  expect((await documentSnapshot(page)).rawText).toContain(
    "| Word bravo | Charlie delta echo |"
  );
  const target = page
    .locator(".cm-draftly-table-cell")
    .filter({ hasText: /^Charlie delta echo$/ });
  const start = await textPoint(target, 8);
  const end = await textPoint(target, 13);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.insertText("DRAG");
  expect((await documentSnapshot(page)).rawText).toContain(
    "| Word bravo | Charlie DRAG echo |"
  );
});

test("source viewport position survives mode, preview, and Settings visits", async ({
  page
}) => {
  await page.goto("/");
  await hydrate(page, markdownFixture(100_000));
  await scrollToSource(page, "Paragraph 70 has");
  const paragraph = page
    .locator(".rich-editor .cm-line")
    .filter({ hasText: /^Paragraph 70 / });
  await expect(paragraph).toBeVisible();
  const initialTop = await paragraph.evaluate(
    (element) => element.getBoundingClientRect().top
  );
  for (const surface of ["source", "preview", "settings"] as const) {
    await setSurface(page, surface);
    await expect(paragraph).toHaveCount(0);
    await setSurface(page, "rich");
    await expect(paragraph).toBeVisible();
    await expect
      .poll(() =>
        paragraph.evaluate((element) => element.getBoundingClientRect().top)
      )
      .toBeGreaterThan(initialTop - 40);
    await expect
      .poll(() =>
        paragraph.evaluate((element) => element.getBoundingClientRect().top)
      )
      .toBeLessThan(initialTop + 40);
  }
});
