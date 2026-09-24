import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
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

function collectDiagramErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/measure loop|plugin.*threw/i.test(message.text()))
      errors.push(message.text());
  });
  return errors;
}

async function settleDiagramParsing(page: Page) {
  await page.evaluate(
    async (url) => {
      const source = await (await fetch(url)).text();
      const resolveModule = (name: string) => {
        const imports = [...source.matchAll(/from\s*["']([^"']+)["']/g)];
        const match = imports.find((entry) => entry[1].includes(name));
        if (!match) throw new Error(`Missing CodeMirror module: ${name}`);
        return match[1];
      };
      const { EditorView } = await import(
        /* @vite-ignore */ resolveModule("codemirror_view")
      );
      const { forceParsing, syntaxTreeAvailable } = await import(
        /* @vite-ignore */ resolveModule("codemirror_language")
      );
      const view = EditorView.findFromDOM(
        document.querySelector(".rich-editor .cm-editor")
      );
      if (!view) throw new Error("Rich editor is missing");
      forceParsing(view, view.state.doc.length, 5000);
      if (!syntaxTreeAvailable(view.state, view.state.doc.length))
        throw new Error("Diagram fixture has not finished parsing");
    },
    `/@fs/${path.resolve("packages/editor/src/sourceEditorExtensions.ts")}`
  );
}

const scrollMarkdown =
  "# Diagram lifecycle\n\n```mermaid\ngraph LR\nA[Start] --> B[Finish]\n```\n\n" +
  Array.from(
    { length: 160 },
    (_, index) => `Paragraph ${index}: scrolling keeps the diagram intact.\n\n`
  ).join("") +
  "Final scroll target.\n";

async function scrollDiagramOutAndBack(
  page: Page,
  whileOffscreen?: () => Promise<void>
) {
  const scroller = page.locator(".rich-editor .cm-scroller");
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    page.locator(".cm-line").filter({ hasText: /^Final scroll target/ })
  ).toBeVisible();
  await expect(page.locator(".cm-draftly-mermaid-rendered")).toHaveCount(0);
  await whileOffscreen?.();
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page.locator(".cm-draftly-mermaid-rendered svg")).toBeVisible();
  await expect(page.locator(".cm-draftly-mermaid-rendered")).not.toContainText(
    "Rendering diagram"
  );
}

test("settled diagrams survive five viewport removals without changing the document", async ({
  page
}) => {
  const errors = collectDiagramErrors(page);
  await page.goto("/");
  await hydrate(page, scrollMarkdown);
  await expect(page.locator(".cm-draftly-mermaid-rendered svg")).toBeVisible();
  await settleDiagramParsing(page);
  const before = await documentSnapshot(page);
  // Parsing may replace an equal decoration without replacing its mounted DOM.
  // Warm the final widget instance, then require all further mounts to reuse it.
  await scrollDiagramOutAndBack(page);
  const svgId = await page
    .locator(".cm-draftly-mermaid-rendered svg")
    .getAttribute("id");
  expect(svgId).toBeTruthy();
  for (let round = 0; round < 5; round++) {
    await scrollDiagramOutAndBack(page, async () => {
      await page
        .locator(".cm-line")
        .filter({ hasText: /^Final scroll target/ })
        .click({ position: { x: 20 + round * 16, y: 8 } });
    });
    await expect(
      page.locator(".cm-draftly-mermaid-rendered svg")
    ).toHaveAttribute("id", svgId!);
    expect(await documentSnapshot(page)).toEqual(before);
  }
  expect(errors).toEqual([]);
});

test("remounted diagrams refresh theme, return from tabs, and remain keyboard editable", async ({
  page
}) => {
  const errors = collectDiagramErrors(page);
  await page.goto("/");
  await hydrate(page, scrollMarkdown);
  await setSurface(page, "light");
  const svg = page.locator(".cm-draftly-mermaid-rendered svg");
  await expect(svg).toBeVisible();
  await settleDiagramParsing(page);
  await scrollDiagramOutAndBack(page);
  const before = await documentSnapshot(page);
  const node = svg.locator(".node rect").first();
  const lightFill = await node.evaluate(
    (element) => getComputedStyle(element).fill
  );
  await setSurface(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(svg).toBeVisible();
  await expect
    .poll(() => node.evaluate((element) => getComputedStyle(element).fill))
    .not.toBe(lightFill);
  await scrollDiagramOutAndBack(page);
  await setSurface(page, "settings");
  await expect(
    page.getByRole("tab", { name: "Settings", exact: true })
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Interaction.md", exact: true }).click();
  await expect(svg).toBeVisible();
  expect(await documentSnapshot(page)).toEqual(before);
  const editButton = page.getByRole("button", { name: /Edit Mermaid diagram/ });
  await editButton.focus();
  await editButton.press("Enter");
  await page.keyboard.insertText("%% keyboard edit\n");
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .toBe(
      scrollMarkdown.replace("```mermaid\n", "```mermaid\n%% keyboard edit\n")
    );
  expect((await documentSnapshot(page)).saveState).toBe("dirty");
  expect(errors).toEqual([]);
});
