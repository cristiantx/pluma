import type {
  DocumentSlice,
  LayoutSlice,
  PlumaShellSnapshot,
  PlumaStoreState,
  StatusSlice,
  TabsSlice,
  WorkspaceSlice
} from "./plumaStoreTypes.js";

type HydratedShellSlices = {
  document: DocumentSlice;
  layout: LayoutSlice;
  status: StatusSlice;
  tabs: TabsSlice;
  workspace: WorkspaceSlice;
};

export function hydratePlumaShellSnapshot(
  state: PlumaStoreState,
  snapshot: PlumaShellSnapshot
): HydratedShellSlices {
  const isNewWorkspace =
    snapshot.hasWorkspace &&
    (!state.workspace.hasWorkspace ||
      state.workspace.workspacePath !== snapshot.workspacePath);
  const hasWorkspaceChanged =
    state.workspace.workspacePath !== snapshot.workspacePath;
  const openDocumentIds = new Set(
    snapshot.documents.map((document) => document.id)
  );
  const splitPaneSizesByDocumentId = Object.fromEntries(
    Object.entries(state.layout.splitPaneSizesByDocumentId).filter(
      ([documentId]) => openDocumentIds.has(documentId)
    )
  );
  const settingsTab = state.tabs.tabs.find((tab) => tab.id === "settings");
  const tabs = settingsTab ? [...snapshot.tabs, settingsTab] : snapshot.tabs;
  const activeTabId =
    snapshot.activeTabId ??
    (state.tabs.activeTabId === "settings"
      ? "settings"
      : (snapshot.activeDocumentId ?? ""));

  return {
    document: {
      activeDocument: snapshot.activeDocument,
      documents: snapshot.documents
    },
    layout: {
      editorViewMode: snapshot.editorViewMode,
      isSidebarVisible: snapshot.hasWorkspace
        ? isNewWorkspace || state.layout.isSidebarVisible
        : false,
      paneSizes: snapshot.paneSizes,
      splitPaneSizesByDocumentId
    },
    status: {
      statusMetrics: snapshot.statusMetrics
    },
    tabs: {
      activeTabId,
      tabs
    },
    workspace: {
      explorerNodes: snapshot.explorerNodes,
      hasWorkspace: snapshot.hasWorkspace,
      isBridgeAvailable: snapshot.isBridgeAvailable,
      isDevelopment: snapshot.isDevelopment,
      revealRequestId: state.workspace.revealRequestId,
      revealWorkspacePath: state.workspace.revealWorkspacePath,
      collapsedSearchResultFiles: hasWorkspaceChanged
        ? []
        : state.workspace.collapsedSearchResultFiles,
      searchFolderPath: hasWorkspaceChanged
        ? null
        : state.workspace.searchFolderPath,
      searchHasSearched: hasWorkspaceChanged
        ? false
        : state.workspace.searchHasSearched,
      searchOptions: state.workspace.searchOptions,
      searchQuery: hasWorkspaceChanged ? "" : state.workspace.searchQuery,
      searchRevealRequest: hasWorkspaceChanged
        ? null
        : state.workspace.searchRevealRequest,
      searchResults: hasWorkspaceChanged ? [] : state.workspace.searchResults,
      searchRequestId: state.workspace.searchRequestId,
      sidebarView: state.workspace.sidebarView,
      workspaceLabel: snapshot.workspaceLabel,
      workspacePath: snapshot.workspacePath
    }
  };
}
