import type { PlumaTab } from "../adapters/tabModel.js";
import type { PlumaStoreState, TabsSlice } from "./plumaStoreTypes.js";

export function closeSettingsTabState(state: PlumaStoreState): {
  nextActiveTabId: string;
  tabs: TabsSlice;
} | null {
  const hasSettingsTab = state.tabs.tabs.some((tab) => tab.id === "settings");

  if (!hasSettingsTab) {
    if (state.tabs.activeTabId !== "settings") {
      return null;
    }

    const nextActiveTabId = state.document.activeDocument?.id ?? "";

    return {
      nextActiveTabId,
      tabs: { activeTabId: nextActiveTabId, tabs: state.tabs.tabs }
    };
  }

  const tabs = state.tabs.tabs.filter((tab) => tab.id !== "settings");
  const nextActiveTabId =
    state.tabs.activeTabId === "settings"
      ? (state.document.activeDocument?.id ?? tabs[0]?.id ?? "")
      : state.tabs.activeTabId;

  return {
    nextActiveTabId,
    tabs: { activeTabId: nextActiveTabId, tabs }
  };
}

export function openSettingsTabState(state: PlumaStoreState): TabsSlice {
  return {
    activeTabId: "settings",
    tabs: state.tabs.tabs.some((tab) => tab.id === "settings")
      ? state.tabs.tabs
      : [
          ...state.tabs.tabs,
          { id: "settings", kind: "settings", title: "Settings" }
        ]
  };
}

export function reorderTabsState(
  state: PlumaStoreState,
  tabs: PlumaTab[]
): TabsSlice {
  return {
    activeTabId: tabs.some((tab) => tab.id === state.tabs.activeTabId)
      ? state.tabs.activeTabId
      : (tabs[0]?.id ?? ""),
    tabs
  };
}

export function activateDocumentTabState(
  state: PlumaStoreState,
  tabId: string
): Pick<PlumaStoreState, "document" | "layout" | "tabs" | "workspace"> {
  return {
    document: {
      activeDocument:
        state.document.documents.find((document) => document.id === tabId) ??
        null,
      documents: state.document.documents
    },
    layout: {
      ...state.layout,
      editorViewMode:
        state.layout.documentViewModes[tabId] ?? state.layout.editorViewMode
    },
    tabs: { ...state.tabs, activeTabId: tabId },
    workspace: {
      ...state.workspace,
      explorerNodes: state.workspace.explorerNodes.map((node) => ({
        ...node,
        isActive:
          node.kind === "file" &&
          state.document.documents.some(
            (document) =>
              document.id === tabId &&
              document.location.kind === "desktop-path" &&
              node.location?.kind === "desktop-path" &&
              document.location.path === node.location.path
          )
      }))
    }
  };
}
