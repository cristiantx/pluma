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
  activeTabId: baseDocuments[0]?.id ?? null,
  documentViewModes: {
    [baseDocuments[0]?.id ?? ""]: "source",
    [baseDocuments[1]?.id ?? ""]: "rich"
  },
  documents: baseDocuments,
  explorerNodes: [
    { depth: 0, id: "guides", kind: "folder", label: "Guides" },
    {
      depth: 1,
      id: "welcome",
      isActive: true,
      kind: "file",
      label: "Welcome.md",
      location: baseTabs[0].location
    },
    {
      depth: 1,
      id: "syntax",
      isActive: false,
      kind: "file",
      label: "Syntax.md",
      location: baseTabs[1].location
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
    expect(state.workspace.explorerNodes).toHaveLength(3);
    expect(state.document.activeDocument?.id).toBe(baseDocuments[0]?.id);
    expect(state.document.documents).toHaveLength(2);
    expect(state.tabs.tabs).toEqual(baseTabs);
    expect(state.tabs.activeTabId).toBe(baseDocuments[0]?.id);
    expect(state.layout.paneSizes).toEqual([210, 770]);
    expect(state.layout.documentViewModes).toEqual(
      baseSnapshot.documentViewModes
    );
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

  it("defaults spellcheck on and updates it in the writing slice", () => {
    expect(usePlumaStore.getState().writing.spellcheckEnabled).toBe(true);

    usePlumaStore.getState().setSpellcheckEnabled(false);

    expect(usePlumaStore.getState().writing.spellcheckEnabled).toBe(false);
    expect(usePlumaStore.getState().theme.preference).toBe("system");
  });

  it("keeps tab state stable until the shell confirms close", () => {
    const closeTab = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ closeTab });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().setActiveTabId(baseDocuments[1]?.id ?? "");

    usePlumaStore.getState().closeTab(baseDocuments[1]?.id ?? "");

    expect(usePlumaStore.getState().tabs.activeTabId).toBe(
      baseDocuments[1]?.id
    );
    expect(usePlumaStore.getState().tabs.tabs).toHaveLength(2);
    expect(usePlumaStore.getState().document.activeDocument?.id).toBe(
      baseDocuments[1]?.id
    );
    expect(closeTab).toHaveBeenCalledWith(baseDocuments[1]?.id);
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
    expect(
      usePlumaStore
        .getState()
        .workspace.explorerNodes.find((node) => node.id === "welcome")?.isActive
    ).toBe(false);
    expect(
      usePlumaStore
        .getState()
        .workspace.explorerNodes.find((node) => node.id === "syntax")?.isActive
    ).toBe(true);
    expect(setActiveTabId).toHaveBeenCalledWith(baseDocuments[1]?.id);
  });

  it("keeps the active document remembered when settings is the active tab", () => {
    const setActiveTabId = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ setActiveTabId });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    usePlumaStore.getState().setActiveTabId("settings");

    expect(usePlumaStore.getState().tabs.activeTabId).toBe("settings");
    expect(usePlumaStore.getState().document.activeDocument?.id).toBe(
      baseDocuments[0]?.id
    );
    expect(setActiveTabId).toHaveBeenCalledWith("settings");
  });

  it("passes all tab ids when opening a tab context menu", () => {
    const showTabContextMenu = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ showTabContextMenu });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().openSettingsTab();

    usePlumaStore.getState().showTabContextMenu("settings");

    expect(showTabContextMenu).toHaveBeenCalledWith("settings", [
      baseDocuments[0]?.id,
      baseDocuments[1]?.id,
      "settings"
    ]);
  });

  it("returns to the remembered document when settings closes", () => {
    const setActiveTabId = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ setActiveTabId });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().openSettingsTab();

    usePlumaStore.getState().closeSettingsTab();

    expect(usePlumaStore.getState().tabs.activeTabId).toBe(
      baseDocuments[0]?.id
    );
    expect(usePlumaStore.getState().tabs.tabs.map((tab) => tab.id)).toEqual([
      baseDocuments[0]?.id,
      baseDocuments[1]?.id
    ]);
    expect(setActiveTabId).toHaveBeenLastCalledWith(baseDocuments[0]?.id);
  });

  it("clears a stale active settings tab when settings has already been removed", () => {
    usePlumaStore.getState().hydrateShellSnapshot({
      ...baseSnapshot,
      activeDocument: null,
      activeDocumentId: null,
      activeTabId: null,
      documents: [],
      tabs: []
    });
    usePlumaStore.setState((state) => ({
      tabs: {
        ...state.tabs,
        activeTabId: "settings"
      }
    }));

    usePlumaStore.getState().closeSettingsTab();

    expect(usePlumaStore.getState().tabs.activeTabId).toBe("");
    expect(usePlumaStore.getState().tabs.tabs).toEqual([]);
  });

  it("notifies the shell when a tab is closed", () => {
    const closeTab = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ closeTab });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    usePlumaStore.getState().closeTab(baseDocuments[0]?.id ?? "");

    expect(closeTab).toHaveBeenCalledWith(baseDocuments[0]?.id);
  });

  it("records reveal workspace file requests", () => {
    usePlumaStore.getState().revealWorkspaceFile(baseTabs[1].location.path);

    expect(usePlumaStore.getState().workspace.revealWorkspacePath).toBe(
      baseTabs[1].location.path
    );
    expect(usePlumaStore.getState().workspace.revealRequestId).toBe(1);

    usePlumaStore.getState().revealWorkspaceFile(baseTabs[1].location.path);

    expect(usePlumaStore.getState().workspace.revealRequestId).toBe(2);
  });

  it("defaults the sidebar to the workspace view", () => {
    expect(usePlumaStore.getState().workspace.sidebarView).toBe("workspace");
  });

  it("switches sidebar views through shared state", () => {
    usePlumaStore.getState().setSidebarView("search");

    expect(usePlumaStore.getState().workspace.sidebarView).toBe("search");

    usePlumaStore.getState().setSidebarView("workspace");

    expect(usePlumaStore.getState().workspace.sidebarView).toBe("workspace");
  });

  it("opens workspace search requests in the search sidebar view", () => {
    usePlumaStore.getState().setSidebarView("workspace");
    usePlumaStore.getState().openWorkspaceSearch("/tmp/pluma/Guides");

    expect(usePlumaStore.getState().workspace.sidebarView).toBe("search");
    expect(usePlumaStore.getState().workspace.searchFolderPath).toBe(
      "/tmp/pluma/Guides"
    );
    expect(usePlumaStore.getState().workspace.searchRequestId).toBe(1);
  });

  it("records workspace search reveal requests", () => {
    const match = {
      filePath: "/tmp/pluma/Notes.md",
      line: 3,
      lineText: "Search target line",
      matchEnd: 13,
      matchStart: 7,
      preview: "Search target line"
    };

    usePlumaStore.getState().revealWorkspaceSearchMatch(match);

    expect(usePlumaStore.getState().workspace.searchRevealRequest).toEqual({
      match,
      requestId: 1
    });

    usePlumaStore.getState().revealWorkspaceSearchMatch(match);

    expect(
      usePlumaStore.getState().workspace.searchRevealRequest?.requestId
    ).toBe(2);
  });

  it("stores workspace search state outside the search panel lifecycle", () => {
    const results = [
      {
        filePath: "/tmp/pluma/Notes.md",
        line: 3,
        lineText: "Search target line",
        matchEnd: 13,
        matchStart: 7,
        preview: "Search target line"
      }
    ];

    usePlumaStore.getState().setWorkspaceSearchQuery("target");
    usePlumaStore.getState().setWorkspaceSearchHasSearched(true);
    usePlumaStore.getState().setWorkspaceSearchOptions({
      caseSensitive: true,
      regexp: false,
      wholeWord: true
    });
    usePlumaStore.getState().setWorkspaceSearchResults(results);
    usePlumaStore.getState().setSidebarView("workspace");
    usePlumaStore.getState().setSidebarView("search");

    expect(usePlumaStore.getState().workspace.searchQuery).toBe("target");
    expect(usePlumaStore.getState().workspace.searchHasSearched).toBe(true);
    expect(usePlumaStore.getState().workspace.searchOptions).toEqual({
      caseSensitive: true,
      regexp: false,
      wholeWord: true
    });
    expect(usePlumaStore.getState().workspace.searchResults).toEqual(results);
  });

  it("toggles collapsed workspace search result groups", () => {
    const filePath = "/tmp/pluma/Notes.md";

    usePlumaStore.getState().toggleWorkspaceSearchResultFile(filePath);

    expect(
      usePlumaStore.getState().workspace.collapsedSearchResultFiles
    ).toEqual([filePath]);

    usePlumaStore.getState().toggleWorkspaceSearchResultFile(filePath);

    expect(
      usePlumaStore.getState().workspace.collapsedSearchResultFiles
    ).toEqual([]);
  });

  it("prunes collapsed workspace search result groups when results change", () => {
    usePlumaStore
      .getState()
      .toggleWorkspaceSearchResultFile("/tmp/pluma/Notes.md");

    usePlumaStore.getState().setWorkspaceSearchResults([
      {
        filePath: "/tmp/pluma/Other.md",
        line: 1,
        lineText: "Other target line",
        matchEnd: 12,
        matchStart: 6,
        preview: "Other target line"
      }
    ]);

    expect(
      usePlumaStore.getState().workspace.collapsedSearchResultFiles
    ).toEqual([]);
  });

  it("resets workspace search state when the workspace changes", () => {
    const match = {
      filePath: "/Users/cristianc/Documents/Pluma Docs/Welcome.md",
      line: 1,
      lineText: "Welcome target",
      matchEnd: 14,
      matchStart: 8,
      preview: "Welcome target"
    };

    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().setWorkspaceSearchQuery("target");
    usePlumaStore.getState().setWorkspaceSearchHasSearched(true);
    usePlumaStore.getState().setWorkspaceSearchResults([match]);
    usePlumaStore.getState().toggleWorkspaceSearchResultFile(match.filePath);
    usePlumaStore.getState().openWorkspaceSearch("/tmp/old-folder");
    usePlumaStore.getState().revealWorkspaceSearchMatch(match);

    usePlumaStore.getState().hydrateShellSnapshot({
      ...baseSnapshot,
      workspacePath: "/Users/cristianc/Documents/New Workspace"
    });

    expect(usePlumaStore.getState().workspace.searchQuery).toBe("");
    expect(usePlumaStore.getState().workspace.searchHasSearched).toBe(false);
    expect(usePlumaStore.getState().workspace.searchResults).toEqual([]);
    expect(
      usePlumaStore.getState().workspace.collapsedSearchResultFiles
    ).toEqual([]);
    expect(usePlumaStore.getState().workspace.searchFolderPath).toBeNull();
    expect(usePlumaStore.getState().workspace.searchRevealRequest).toBeNull();
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

    usePlumaStore.getState().setEditorViewMode("rich");

    expect(usePlumaStore.getState().layout.editorViewMode).toBe("rich");
    expect(setEditorViewMode).toHaveBeenCalledWith("rich");
  });

  it("switches to a document's remembered view mode when selecting its tab", () => {
    const setActiveTabId = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ setActiveTabId });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    usePlumaStore.getState().setActiveTabId(baseDocuments[1]?.id ?? "");

    expect(usePlumaStore.getState().layout.editorViewMode).toBe("rich");
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

  it("keeps tab references stable when edited tab dirtiness is unchanged", () => {
    const updateDocumentText = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ updateDocumentText });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    const currentTabs = usePlumaStore.getState().tabs.tabs;

    usePlumaStore
      .getState()
      .updateDocumentText(baseDocuments[1]?.id ?? "", "# Edited\n");

    expect(usePlumaStore.getState().tabs.tabs).toBe(currentTabs);
    expect(updateDocumentText).toHaveBeenCalledWith(
      baseDocuments[1]?.id,
      "# Edited\n"
    );
  });

  it("ignores unchanged document text updates", () => {
    const updateDocumentText = vi.fn();
    usePlumaStore.getState().setCommandHandlers({ updateDocumentText });
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    const currentDocuments = usePlumaStore.getState().document.documents;

    usePlumaStore
      .getState()
      .updateDocumentText(baseDocuments[0]?.id ?? "", "# Welcome\n");

    expect(usePlumaStore.getState().document.documents).toBe(currentDocuments);
    expect(updateDocumentText).not.toHaveBeenCalled();
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
    const newFile = vi.fn();
    const openWorkspaceFile = vi.fn();

    usePlumaStore.getState().setCommandHandlers({
      newFile,
      openDevTools,
      openFile,
      openWorkspaceFile
    });
    usePlumaStore.getState().triggerOpenDevTools();
    usePlumaStore.getState().triggerNewFile();
    usePlumaStore.getState().triggerOpenFile();
    usePlumaStore.getState().triggerOpenWorkspaceFile("/tmp/Notes.md");

    expect(openDevTools).toHaveBeenCalledTimes(1);
    expect(newFile).toHaveBeenCalledTimes(1);
    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openWorkspaceFile).toHaveBeenCalledWith("/tmp/Notes.md");
  });
});
