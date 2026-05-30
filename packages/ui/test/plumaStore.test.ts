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
  editorViewMode: "source",
  hasWorkspace: true,
  isBridgeAvailable: true,
  isDevelopment: false,
  paneSizes: [210, 770],
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
    expect(state.workspace.isDevelopment).toBe(false);
    expect(state.workspace.explorerNodes).toHaveLength(2);
    expect(state.document.activeDocument?.id).toBe(baseDocuments[0]?.id);
    expect(state.document.documents).toHaveLength(2);
    expect(state.tabs.tabs).toEqual(baseTabs);
    expect(state.tabs.activeTabId).toBe(baseDocuments[0]?.id);
    expect(state.layout.paneSizes).toEqual([210, 770]);
    expect(state.layout.editorViewMode).toBe("source");
    expect(state.layout.isSidebarVisible).toBe(true);
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

  it("notifies the shell when the active tab changes", () => {
    const setActiveTabId = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ setActiveTabId });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    usePlumaStore.getState().setActiveTabId(baseDocuments[1]?.id ?? "");

    expect(usePlumaStore.getState().tabs.activeTabId).toBe(
      baseDocuments[1]?.id
    );
    expect(usePlumaStore.getState().document.activeDocument?.id).toBe(
      baseDocuments[1]?.id
    );
    expect(setActiveTabId).toHaveBeenCalledWith(baseDocuments[1]?.id);
  });

  it("notifies the shell when a tab is closed", () => {
    const closeTab = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ closeTab });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    usePlumaStore.getState().closeTab(baseDocuments[0]?.id ?? "");

    expect(closeTab).toHaveBeenCalledWith(baseDocuments[0]?.id);
  });

  it("notifies the shell when pane sizes change", () => {
    const updatePaneSizes = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ updatePaneSizes });

    usePlumaStore.getState().updatePaneSizes([240, 760]);

    expect(usePlumaStore.getState().layout.paneSizes).toEqual([240, 760]);
    expect(updatePaneSizes).toHaveBeenCalledWith([240, 760]);
  });

  it("sets the editor view mode through shared state", () => {
    const setEditorViewMode = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ setEditorViewMode });

    usePlumaStore.getState().setEditorViewMode("split");

    expect(usePlumaStore.getState().layout.editorViewMode).toBe("split");
    expect(setEditorViewMode).toHaveBeenCalledWith("split");
  });

  it("updates active document text and dirty tab state", () => {
    const updateDocumentText = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ updateDocumentText });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    usePlumaStore
      .getState()
      .updateDocumentText(baseDocuments[0]?.id ?? "", "# Edited\n");

    expect(usePlumaStore.getState().document.activeDocument?.rawText).toBe(
      "# Edited\n"
    );
    expect(usePlumaStore.getState().document.activeDocument?.saveState).toBe(
      "dirty"
    );
    expect(usePlumaStore.getState().tabs.tabs[0]?.isDirty).toBe(true);
    expect(updateDocumentText).toHaveBeenCalledWith(
      baseDocuments[0]?.id,
      "# Edited\n"
    );
  });

  it("keeps sidebar visibility scoped to workspace state", () => {
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().toggleSidebar();

    expect(usePlumaStore.getState().layout.isSidebarVisible).toBe(false);

    usePlumaStore.getState().hydrateShellSnapshot({
      ...baseSnapshot,
      activeDocument: baseDocuments[1] ?? null,
      activeDocumentId: baseDocuments[1]?.id ?? null
    });

    expect(usePlumaStore.getState().layout.isSidebarVisible).toBe(false);

    usePlumaStore.getState().hydrateShellSnapshot({
      ...baseSnapshot,
      hasWorkspace: false,
      workspaceLabel: "No workspace open",
      workspacePath: "/Users/cristianc/Documents/Standalone.md"
    });

    expect(usePlumaStore.getState().layout.isSidebarVisible).toBe(false);

    usePlumaStore.getState().hydrateShellSnapshot({
      ...baseSnapshot,
      workspacePath: "/Users/cristianc/Documents/New Workspace"
    });

    expect(usePlumaStore.getState().layout.isSidebarVisible).toBe(true);
  });

  it("triggers registered commands through typed handlers", () => {
    const openDevTools = vi.fn();
    const openFile = vi.fn();
    const openWorkspaceFile = vi.fn();

    usePlumaStore.getState().setCommandHandlers({
      openDevTools,
      openFile,
      openWorkspaceFile
    });
    usePlumaStore.getState().triggerOpenDevTools();
    usePlumaStore.getState().triggerOpenFile();
    usePlumaStore.getState().triggerOpenWorkspaceFile("/tmp/Notes.md");

    expect(openDevTools).toHaveBeenCalledTimes(1);
    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openWorkspaceFile).toHaveBeenCalledWith("/tmp/Notes.md");
  });
});
