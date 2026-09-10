import { expect, type Page } from "@playwright/test";
import path from "node:path";
import type { QuickAccessServices } from "../../../../packages/ui/src/state/plumaQuickAccessTypes.js";
import { hydrate, textPoint } from "../../rendererHarness.js";

const uiUrl = `/@fs/${path.resolve("packages/ui/src/index.ts")}`;
const coreUrl = `/@fs/${path.resolve("packages/core/src/index.ts")}`;
type RecordedWindow = Window & { quickAccessCalls?: string[] };

export async function hydrateQuickAccess(page: Page, hasWorkspace = true) {
  await hydrate(page, "Quick access preserves this selection.\n");
  await page.evaluate(
    async ({ uiUrl, coreUrl, hasWorkspace }) => {
      const { usePlumaStore } = await import(/* @vite-ignore */ uiUrl);
      const { createDocumentSession, searchFiles } = await import(
        /* @vite-ignore */ coreUrl
      );
      const documents = [
        createDocumentSession({
          location: {
            kind: "desktop-path",
            path: "/workspace/notes/Meeting.md",
            name: "Meeting.md"
          },
          metadata: null,
          rawText: "Quick access preserves this selection.\n"
        }),
        createDocumentSession({
          location: {
            kind: "desktop-path",
            path: "/workspace/archive/Meeting.md",
            name: "Meeting.md"
          },
          metadata: null,
          rawText: "Archived meeting content.\n"
        }),
        createDocumentSession({
          location: {
            kind: "app-draft",
            draftId: "quick-untitled",
            name: "Untitled.md"
          },
          metadata: null,
          rawText: "Unsaved writing.\n"
        })
      ];
      const calls: string[] = [];
      (window as RecordedWindow).quickAccessCalls = calls;
      usePlumaStore.getState().hydrateShellSnapshot({
        activeDocument: documents[0],
        activeDocumentId: documents[0].id,
        activeTabId: documents[0].id,
        documents,
        documentViewModes: Object.fromEntries(
          documents.map((document) => [document.id, "rich"])
        ),
        explorerNodes: hasWorkspace
          ? [
              {
                id: "/workspace/notes/Meeting.md",
                label: "Meeting.md",
                depth: 1,
                kind: "file"
              },
              {
                id: "/workspace/archive/Meeting.md",
                label: "Meeting.md",
                depth: 1,
                kind: "file"
              },
              {
                id: "/workspace/Roadmap.md",
                label: "Roadmap.md",
                depth: 0,
                kind: "file"
              }
            ]
          : [],
        hasWorkspace,
        isBridgeAvailable: true,
        isDevelopment: false,
        editorViewMode: "rich",
        paneSizes: [100],
        tabs: documents.map((document) => ({
          kind: "document",
          id: document.id,
          title: document.location.name,
          location: document.location
        })),
        workspaceLabel: "Workspace",
        workspacePath: hasWorkspace ? "/workspace" : "",
        workspaceIndex: {
          generation: 1,
          revision: 1,
          status: "ready",
          error: null
        }
      });
      const services: QuickAccessServices = {
        platform: "darwin",
        nativeAccelerators: false,
        search: async (candidates, query) => searchFiles(candidates, query),
        activate: async (target) => {
          calls.push(`activate:${target.kind}`);
          if (target.kind === "open-document") {
            usePlumaStore
              .getState()
              .hydrateActiveDocumentChange(
                target.documentId,
                target.documentId,
                "rich"
              );
          }
          return { status: "executed" };
        },
        execute: async (request) => {
          calls.push(`command:${request.id}`);
          return { status: "executed" };
        },
        flush: async () => {
          calls.push("flush");
          return { status: "executed" };
        },
        setOpen: () => {},
        refresh: async () => {}
      };
      usePlumaStore.getState().setQuickAccessServices(services);
    },
    { uiUrl, coreUrl, hasWorkspace }
  );
  await expect(
    page.locator(".rich-editor .cm-content[contenteditable=true]")
  ).toBeVisible();
}

export async function quickAccessSnapshot(page: Page) {
  return page.evaluate(async (uiUrl) => {
    const { usePlumaStore } = await import(/* @vite-ignore */ uiUrl);
    const state = usePlumaStore.getState();
    return {
      activeId: state.tabs.activeTabId as string,
      rawText: state.document.activeDocument.rawText as string,
      calls: [...((window as RecordedWindow).quickAccessCalls ?? [])]
    };
  }, uiUrl);
}

export async function selectQuickAccessText(page: Page) {
  const line = page
    .locator(".rich-editor .cm-line")
    .filter({ hasText: /^Quick access preserves/ });
  const start = await textPoint(line, 0);
  const end = await textPoint(line, 5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}
