import type { Page } from "@playwright/test";
import path from "node:path";

export async function selectionSnapshot(page: Page) {
  return page.evaluate(
    async (url) => {
      const transformed = await (await fetch(url)).text();
      const match = transformed.match(
        /import\s*\{\s*EditorView\s*\}\s*from\s*["']([^"']+)["']/
      );
      if (!match)
        throw new Error("Cannot resolve served CodeMirror view module");
      const { EditorView } = await import(/* @vite-ignore */ match[1]);
      const element = document.querySelector(".editor-panes .cm-editor");
      if (!element) throw new Error("Editor is not mounted");
      const view = EditorView.findFromDOM(element);
      if (!view) throw new Error("Editor has no CodeMirror view");
      const { anchor, head, from, to } = view.state.selection.main;
      return {
        anchor: anchor as number,
        head: head as number,
        text: view.state.sliceDoc(from, to) as string
      };
    },
    `/@fs/${path.resolve("packages/editor/src/sourceEditorInterop.ts")}`
  );
}

export async function addSecondDocument(page: Page) {
  await page.evaluate(
    async ({ uiUrl, coreUrl }) => {
      const { usePlumaStore } = await import(/* @vite-ignore */ uiUrl);
      const { createDocumentSession } = await import(
        /* @vite-ignore */ coreUrl
      );
      const document = createDocumentSession({
        location: { kind: "app-draft", draftId: "second", name: "Second.md" },
        metadata: null,
        rawText: "# Second document\n\nOther document content.\n"
      });
      const previous = usePlumaStore.getState().tabs.activeTabId;
      usePlumaStore.getState().hydrateDocumentOpened(document, 1, "rich");
      usePlumaStore.getState().setActiveTabId(previous);
    },
    {
      uiUrl: `/@fs/${path.resolve("packages/ui/src/index.ts")}`,
      coreUrl: `/@fs/${path.resolve("packages/core/src/index.ts")}`
    }
  );
}
