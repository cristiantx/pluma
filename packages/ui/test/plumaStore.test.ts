import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDocumentSession, type DocumentSession } from "@pluma/core";
import type { EditorTab } from "../src/adapters/tabModel.js";
import {
  initialPlumaStoreState,
  usePlumaStore
} from "../src/state/usePlumaStore.js";
import type { PlumaShellSnapshot } from "../src/state/plumaStoreTypes.js";

const baseTabs: EditorTab[] = [
  {
    id: "desktop:/Users/cristianc/Documents/Pluma Docs/Welcome.md",
    isDirty: false,
    location: {
      kind: "desktop-path",
      path: "/Users/cristianc/Documents/Pluma Docs/Welcome.md"
    },
    title: "Welcome.md"
  },
  {
    id: "desktop:/Users/cristianc/Documents/Pluma Docs/Syntax.md",
    isDirty: true,
    location: {
      kind: "desktop-path",
      path: "/Users/cristianc/Documents/Pluma Docs/Syntax.md"
    },
    title: "Syntax.md"
  }
];

const baseDocuments: DocumentSession[] = [
  createDocumentSession({
    location: baseTabs[0].location,
    metadata: {
      fileId: "1",
      mtimeMs: 10,
      size: 12
    },
    rawText: "# Welcome\n"
  }),
  createDocumentSession({
    location: baseTabs[1].location,
    metadata: {
      fileId: "2",
      mtimeMs: 12,
      size: 20
    },
    rawText: "# Syntax\n"
  })
];

const baseSnapshot: PlumaShellSnapshot = {
  activeDocument: baseDocuments[0] ?? null,
  activeDocumentId: baseDocuments[0]?.id ?? null,
  documents: baseDocuments,
  explorerNodes: [
    { depth: 0, id: "guides", kind: "folder", label: "Guides" },
    {
      depth: 1,
      id: "welcome",
      isActive: true,
      kind: "file",
      label: "Welcome.md"
    }
  ],
  hasWorkspace: true,
  isBridgeAvailable: true,
  statusMetrics: [
    { label: "Words", value: "312" },
    { label: "Lines", value: "28" }
  ],
  tabs: baseTabs,
  workspaceLabel: "PLUMA DOCS",
  workspacePath: "/Users/cristianc/Documents/Pluma Docs"
};

beforeEach(() => {
  usePlumaStore.setState({
    ...usePlumaStore.getState(),
    ...initialPlumaStoreState
  });
});

describe("usePlumaStore", () => {
  it("hydrates shell data into shared slices", () => {
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    const state = usePlumaStore.getState();

    expect(state.workspace.workspaceLabel).toBe("PLUMA DOCS");
    expect(state.workspace.hasWorkspace).toBe(true);
    expect(state.workspace.explorerNodes).toHaveLength(2);
    expect(state.document.activeDocument?.id).toBe(baseDocuments[0]?.id);
    expect(state.document.documents).toHaveLength(2);
    expect(state.tabs.tabs).toEqual(baseTabs);
    expect(state.tabs.activeTabId).toBe(baseDocuments[0]?.id);
    expect(state.status.statusMetrics[0]?.value).toBe("312");
  });

  it("replaces tabs when a new shell snapshot arrives", () => {
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().reorderTabs([...baseTabs].reverse());

    usePlumaStore.getState().hydrateShellSnapshot({
      ...baseSnapshot,
      activeDocument: baseDocuments[0] ?? null,
      activeDocumentId: baseDocuments[0]?.id ?? null,
      documents: [baseDocuments[0]].filter(Boolean) as DocumentSession[],
      tabs: [baseTabs[0]]
    });

    expect(usePlumaStore.getState().tabs.tabs).toEqual([baseTabs[0]]);
  });

  it("resolves theme preferences against the system theme", () => {
    usePlumaStore.getState().setSystemPrefersDark(true);
    usePlumaStore.getState().setThemePreference("system");

    expect(usePlumaStore.getState().theme.resolvedTheme).toBe("dark");

    usePlumaStore.getState().toggleTheme();

    expect(usePlumaStore.getState().theme.preference).toBe("light");
    expect(usePlumaStore.getState().theme.resolvedTheme).toBe("light");
  });

  it("closes tabs and reassigns the active tab", () => {
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().setActiveTabId(baseDocuments[1]?.id ?? "");

    usePlumaStore.getState().closeTab(baseDocuments[1]?.id ?? "");

    expect(usePlumaStore.getState().tabs.activeTabId).toBe(
      baseDocuments[0]?.id
    );
    expect(usePlumaStore.getState().tabs.tabs).toHaveLength(1);
    expect(usePlumaStore.getState().document.activeDocument?.id).toBe(
      baseDocuments[0]?.id
    );
  });

  it("triggers registered commands through typed handlers", () => {
    const openFile = vi.fn();
    const openWorkspaceFile = vi.fn();

    usePlumaStore.getState().setCommandHandlers({
      openFile,
      openWorkspaceFile
    });
    usePlumaStore.getState().triggerOpenFile();
    usePlumaStore.getState().triggerOpenWorkspaceFile("/tmp/Notes.md");

    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openWorkspaceFile).toHaveBeenCalledWith("/tmp/Notes.md");
  });
});
