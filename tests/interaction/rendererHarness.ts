import { expect, type Locator, type Page } from "@playwright/test";
import path from "node:path";

const uiUrl = `/@fs/${path.resolve("packages/ui/src/index.ts")}`;
const coreUrl = `/@fs/${path.resolve("packages/core/src/index.ts")}`;

export async function hydrate(page: Page, rawText: string) {
  await expect(page.locator(".editor-workspace")).toBeVisible();
  await page.evaluate(
    async ({ uiUrl, coreUrl, rawText }) => {
      const { usePlumaStore } = await import(/* @vite-ignore */ uiUrl);
      const { createDocumentSession } = await import(
        /* @vite-ignore */ coreUrl
      );
      const document = createDocumentSession({
        location: {
          kind: "app-draft",
          draftId: "interaction",
          name: "Interaction.md"
        },
        metadata: null,
        rawText
      });
      usePlumaStore.getState().setCommandHandlers({
        updateDocumentText: () => {},
        setActiveTabId: () => {},
        setEditorViewMode: () => {},
        updateSettings: async (settings) => ({
          ...usePlumaStore.getState().settings,
          ...settings
        }),
        closeTab: (id) => usePlumaStore.getState().hydrateDocumentClosed(id)
      });
      for (const notification of usePlumaStore.getState().status
        .notifications) {
        if (notification.message === "Renderer loaded without preload bridge.")
          usePlumaStore.getState().dismissNotification(notification.id);
      }
      usePlumaStore.getState().hydrateShellSnapshot({
        activeDocument: document,
        activeDocumentId: document.id,
        activeTabId: document.id,
        documents: [document],
        documentViewModes: { [document.id]: "rich" },
        explorerNodes: [],
        hasWorkspace: false,
        isBridgeAvailable: true,
        isDevelopment: false,
        editorViewMode: "rich",
        paneSizes: [100],
        tabs: [
          {
            id: document.id,
            title: "Interaction.md",
            location: document.location
          }
        ],
        workspaceLabel: "Test",
        workspacePath: ""
      });
    },
    { uiUrl, coreUrl, rawText }
  );
  await expect(
    page.locator(".rich-editor .cm-content[contenteditable=true]")
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

export async function documentSnapshot(page: Page) {
  return page.evaluate(async (url) => {
    const { usePlumaStore } = await import(/* @vite-ignore */ url);
    const doc = usePlumaStore.getState().document.activeDocument;
    return {
      rawText: doc.rawText as string,
      saveState: doc.saveState as string
    };
  }, uiUrl);
}

export async function setSurface(
  page: Page,
  surface: "rich" | "source" | "preview" | "settings" | "light" | "dark"
) {
  await page.evaluate(
    async ({ url, surface }) => {
      const { usePlumaStore } = await import(/* @vite-ignore */ url);
      const state = usePlumaStore.getState();
      if (surface === "settings") state.openSettingsTab();
      else if (surface === "light" || surface === "dark")
        state.setThemePreference(surface);
      else {
        state.setActiveTabId(state.document.documents[0].id);
        usePlumaStore.getState().setEditorViewMode(surface);
      }
    },
    { url: uiUrl, surface }
  );
}

// DOM text ranges determine geometry without consulting editor position mapping.
export async function textPoint(locator: Locator, offset: number) {
  await locator.scrollIntoViewIfNeeded();
  return locator.evaluate((element, offset) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let remaining = offset;
    while (node && remaining > (node.textContent?.length ?? 0)) {
      remaining -= node.textContent?.length ?? 0;
      node = walker.nextNode();
    }
    if (!node) throw new Error("Text offset outside target");
    const range = document.createRange();
    range.setStart(node, remaining);
    range.setEnd(node, Math.min(remaining + 1, node.textContent!.length));
    const rect = range.getBoundingClientRect();
    if (!rect.height) throw new Error("Text target has no geometry");
    return { x: rect.x + 0.5, y: rect.y + rect.height / 2 };
  }, offset);
}

export async function insertAt(
  page: Page,
  locator: Locator,
  offset: number,
  marker: string
) {
  const original = await locator.textContent();
  const before = (await documentSnapshot(page)).rawText;
  const sourceStart = before.indexOf(original!);
  expect(sourceStart).toBeGreaterThanOrEqual(0);
  // Fixture targets use their first occurrence (Cell1 also prefixes Cell10).
  const point = await textPoint(locator, offset);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.insertText(marker);
  const expected =
    before.slice(0, sourceStart + offset) +
    marker +
    before.slice(sourceStart + offset);
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .toBe(expected);
}

export async function editorSnapshot(page: Page) {
  const interopUrl = `/@fs/${path.resolve("packages/editor/src/sourceEditorInterop.ts")}`;
  return page.evaluate(async (url) => {
    const transformed = await (await fetch(url)).text();
    const match = transformed.match(
      /import\s*\{\s*EditorView\s*\}\s*from\s*["']([^"']+)["']/
    );
    if (!match) throw new Error("Cannot resolve served CodeMirror view module");
    const { EditorView } = await import(/* @vite-ignore */ match[1]);
    const dom = document.querySelector(".rich-editor .cm-editor");
    if (!dom) throw new Error("Rich editor is not mounted");
    const view = EditorView.findFromDOM(dom);
    if (!view) throw new Error("Rich editor has no CodeMirror view");
    const { from, to } = view.state.selection.main;
    return {
      rawText: view.state.doc.toString() as string,
      selectedText: view.state.sliceDoc(from, to) as string
    };
  }, interopUrl);
}
