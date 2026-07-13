import { getFileLocationName, type DocumentSession } from "@pluma/core";

import type { PlumaTab } from "../adapters/tabModel.js";
import type {
  DesktopWorkspaceHydration,
  DocumentSessionPatch,
  EditorViewMode,
  PlumaStoreState
} from "./plumaStoreTypes.js";

type DesktopDocumentUpdate = Pick<
  PlumaStoreState,
  "document" | "layout" | "tabs"
>;

export function openDesktopDocumentState(
  state: PlumaStoreState,
  document: DocumentSession,
  index: number,
  viewMode: EditorViewMode
): DesktopDocumentUpdate {
  const documents = state.document.documents.filter(
    (candidate) => candidate.id !== document.id
  );
  documents.splice(Math.max(0, Math.min(index, documents.length)), 0, document);

  return {
    document: {
      activeDocument:
        state.document.activeDocument?.id === document.id
          ? document
          : state.document.activeDocument,
      documents
    },
    layout: {
      ...state.layout,
      documentViewModes: {
        ...state.layout.documentViewModes,
        [document.id]: viewMode
      }
    },
    tabs: {
      ...state.tabs,
      tabs: insertDocumentTab(
        state.tabs.tabs,
        createDocumentTab(document),
        index
      )
    }
  };
}

export function patchDesktopDocumentState(
  state: PlumaStoreState,
  documentId: string,
  patch: DocumentSessionPatch
): Pick<PlumaStoreState, "document" | "tabs"> | null {
  const currentDocument = state.document.documents.find(
    (document) => document.id === documentId
  );

  if (!currentDocument) {
    return null;
  }

  const nextDocument = { ...currentDocument, ...patch };
  const documents = state.document.documents.map((document) =>
    document.id === documentId ? nextDocument : document
  );

  return {
    document: {
      activeDocument:
        state.document.activeDocument?.id === documentId
          ? nextDocument
          : state.document.activeDocument,
      documents
    },
    tabs: {
      ...state.tabs,
      tabs: state.tabs.tabs.map((tab) =>
        tab.id === documentId ? createDocumentTab(nextDocument) : tab
      )
    }
  };
}

export function closeDesktopDocumentState(
  state: PlumaStoreState,
  documentId: string
): DesktopDocumentUpdate {
  const documents = state.document.documents.filter(
    (document) => document.id !== documentId
  );
  const documentViewModes = { ...state.layout.documentViewModes };
  delete documentViewModes[documentId];

  return {
    document: {
      activeDocument:
        state.document.activeDocument?.id === documentId
          ? null
          : state.document.activeDocument,
      documents
    },
    layout: {
      ...state.layout,
      documentViewModes
    },
    tabs: {
      activeTabId:
        state.tabs.activeTabId === documentId ? "" : state.tabs.activeTabId,
      tabs: state.tabs.tabs.filter((tab) => tab.id !== documentId)
    }
  };
}

export function activateDesktopDocumentState(
  state: PlumaStoreState,
  activeDocumentId: string | null,
  activeTabId: string | null,
  editorViewMode: EditorViewMode
): Pick<PlumaStoreState, "document" | "layout" | "tabs" | "workspace"> {
  const activeDocument =
    state.document.documents.find(
      (document) => document.id === activeDocumentId
    ) ?? null;
  const activePath =
    activeDocument?.location.kind === "desktop-path"
      ? activeDocument.location.path
      : null;

  return {
    document: {
      ...state.document,
      activeDocument
    },
    layout: {
      ...state.layout,
      editorViewMode
    },
    tabs: {
      ...state.tabs,
      activeTabId: activeTabId ?? activeDocumentId ?? ""
    },
    workspace: {
      ...state.workspace,
      explorerNodes: state.workspace.explorerNodes.map((node) => ({
        ...node,
        isActive: node.kind === "file" && node.id === activePath
      }))
    }
  };
}

export function hydrateDesktopWorkspaceState(
  state: PlumaStoreState,
  hydration: DesktopWorkspaceHydration
): Pick<PlumaStoreState, "layout" | "workspace"> {
  const workspaceChanged =
    state.workspace.workspacePath !== hydration.workspacePath;

  return {
    layout: {
      ...state.layout,
      isSidebarVisible: hydration.hasWorkspace
        ? workspaceChanged || state.layout.isSidebarVisible
        : false
    },
    workspace: {
      ...state.workspace,
      ...hydration,
      collapsedSearchResultFiles: workspaceChanged
        ? []
        : state.workspace.collapsedSearchResultFiles,
      searchFolderPath: workspaceChanged
        ? null
        : state.workspace.searchFolderPath,
      searchHasSearched: workspaceChanged
        ? false
        : state.workspace.searchHasSearched,
      searchQuery: workspaceChanged ? "" : state.workspace.searchQuery,
      searchResults: workspaceChanged ? [] : state.workspace.searchResults,
      searchRevealRequest: workspaceChanged
        ? null
        : state.workspace.searchRevealRequest
    }
  };
}

export function hydrateDesktopDocumentViewModeState(
  state: PlumaStoreState,
  documentId: string,
  mode: EditorViewMode
): Pick<PlumaStoreState, "layout"> {
  return {
    layout: {
      ...state.layout,
      documentViewModes: {
        ...state.layout.documentViewModes,
        [documentId]: mode
      }
    }
  };
}

function createDocumentTab(document: DocumentSession): PlumaTab {
  return {
    id: document.id,
    isDirty: document.saveState !== "idle",
    kind: "document" as const,
    location: document.location,
    title: getFileLocationName(document.location)
  };
}

function insertDocumentTab(
  currentTabs: PlumaTab[],
  documentTab: PlumaTab,
  index: number
): PlumaTab[] {
  const documentTabs = currentTabs.filter(
    (tab) => tab.kind !== "settings" && tab.id !== documentTab.id
  );
  documentTabs.splice(
    Math.max(0, Math.min(index, documentTabs.length)),
    0,
    documentTab
  );
  const settingsTab = currentTabs.find((tab) => tab.kind === "settings");
  return settingsTab ? [...documentTabs, settingsTab] : documentTabs;
}
