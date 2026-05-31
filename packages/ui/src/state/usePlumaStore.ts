import { create } from "zustand";

import { updateDocumentSessionText } from "@pluma/core";

import { resolveThemePreference } from "../theme.js";
import type {
  PlumaCommandHandlers,
  PlumaStoreInitializer,
  PlumaShellSnapshot,
  PlumaStore
} from "./plumaStoreTypes.js";

const noop = () => {};

const defaultCommandHandlers: PlumaCommandHandlers = {
  closeTab: noop,
  compareConflict: noop,
  keepEditing: noop,
  openDevTools: noop,
  openFile: noop,
  openFolder: noop,
  openWorkspaceFile: noop,
  reloadFromDisk: noop,
  setActiveTabId: noop,
  setEditorViewMode: noop,
  updateDocumentText: noop,
  updatePaneSizes: noop,
  toggleMode: noop
};

export const initialPlumaStoreState: PlumaStoreInitializer = {
  commands: {
    commandHandlers: defaultCommandHandlers
  },
  document: {
    activeDocument: null,
    documents: []
  },
  layout: {
    editorViewMode: "source",
    isSidebarVisible: true,
    paneSizes: []
  },
  status: {
    statusMetrics: []
  },
  tabs: {
    activeTabId: "",
    tabs: []
  },
  theme: {
    preference: "system",
    resolvedTheme: "light",
    systemPrefersDark: false
  },
  workspace: {
    explorerNodes: [],
    hasWorkspace: false,
    isBridgeAvailable: false,
    isDevelopment: false,
    workspaceLabel: "No workspace open",
    workspacePath: "~/Documents/Pluma Docs"
  }
};

export const usePlumaStore = create<PlumaStore>()((set, get) => ({
  ...initialPlumaStoreState,

  closeTab: (tabId) => {
    const closeTabHandler = get().commands.commandHandlers.closeTab;

    set((state) => {
      const nextTabs = state.tabs.tabs.filter((tab) => tab.id !== tabId);
      const nextDocuments = state.document.documents.filter(
        (document) => document.id !== tabId
      );
      const nextActiveTabId =
        state.tabs.activeTabId === tabId
          ? (nextTabs[0]?.id ?? "")
          : state.tabs.activeTabId;
      const nextActiveDocument =
        nextDocuments.find((document) => document.id === nextActiveTabId) ??
        null;

      return {
        document: {
          activeDocument: nextActiveDocument,
          documents: nextDocuments
        },
        tabs: {
          activeTabId: nextActiveTabId,
          tabs: nextTabs
        }
      };
    });

    closeTabHandler(tabId);
  },

  compareConflict: () => {
    get().commands.commandHandlers.compareConflict();
  },

  hydrateShellSnapshot: (snapshot: PlumaShellSnapshot) => {
    set((state) => {
      const isNewWorkspace =
        snapshot.hasWorkspace &&
        (!state.workspace.hasWorkspace ||
          state.workspace.workspacePath !== snapshot.workspacePath);

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
          paneSizes: snapshot.paneSizes
        },
        status: {
          statusMetrics: snapshot.statusMetrics
        },
        tabs: {
          activeTabId: snapshot.activeDocumentId ?? "",
          tabs: snapshot.tabs
        },
        workspace: {
          explorerNodes: snapshot.explorerNodes,
          hasWorkspace: snapshot.hasWorkspace,
          isBridgeAvailable: snapshot.isBridgeAvailable,
          isDevelopment: snapshot.isDevelopment,
          workspaceLabel: snapshot.workspaceLabel,
          workspacePath: snapshot.workspacePath
        }
      };
    });
  },

  reorderTabs: (tabs) => {
    set((state) => ({
      tabs: {
        activeTabId: tabs.some((tab) => tab.id === state.tabs.activeTabId)
          ? state.tabs.activeTabId
          : (tabs[0]?.id ?? ""),
        tabs
      }
    }));
  },

  keepEditing: () => {
    get().commands.commandHandlers.keepEditing();
  },

  reloadFromDisk: () => {
    get().commands.commandHandlers.reloadFromDisk();
  },

  setActiveTabId: (tabId) => {
    set((state) => ({
      document: {
        activeDocument:
          state.document.documents.find((document) => document.id === tabId) ??
          null,
        documents: state.document.documents
      },
      tabs: {
        ...state.tabs,
        activeTabId: tabId
      }
    }));
    get().commands.commandHandlers.setActiveTabId(tabId);
  },

  setCommandHandlers: (handlers) => {
    set((state) => ({
      commands: {
        commandHandlers: {
          ...state.commands.commandHandlers,
          ...handlers
        }
      }
    }));
  },

  setEditorViewMode: (mode) => {
    set((state) => ({
      layout: {
        ...state.layout,
        editorViewMode: mode
      }
    }));
    get().commands.commandHandlers.setEditorViewMode(mode);
  },

  setSystemPrefersDark: (matches) => {
    set((state) => ({
      theme: {
        preference: state.theme.preference,
        resolvedTheme: resolveThemePreference(state.theme.preference, matches),
        systemPrefersDark: matches
      }
    }));
  },

  setThemePreference: (preference) => {
    set((state) => ({
      theme: {
        preference,
        resolvedTheme: resolveThemePreference(
          preference,
          state.theme.systemPrefersDark
        ),
        systemPrefersDark: state.theme.systemPrefersDark
      }
    }));
  },

  toggleTheme: () => {
    set((state) => {
      const nextPreference =
        state.theme.resolvedTheme === "dark" ? "light" : "dark";

      return {
        theme: {
          preference: nextPreference,
          resolvedTheme: resolveThemePreference(
            nextPreference,
            state.theme.systemPrefersDark
          ),
          systemPrefersDark: state.theme.systemPrefersDark
        }
      };
    });
  },

  toggleSidebar: () => {
    set((state) => ({
      layout: {
        ...state.layout,
        isSidebarVisible: !state.layout.isSidebarVisible
      }
    }));
  },

  triggerOpenFile: () => {
    get().commands.commandHandlers.openFile();
  },

  triggerOpenDevTools: () => {
    get().commands.commandHandlers.openDevTools();
  },

  triggerOpenFolder: () => {
    get().commands.commandHandlers.openFolder();
  },

  triggerOpenWorkspaceFile: (path) => {
    get().commands.commandHandlers.openWorkspaceFile(path);
  },

  updateDocumentText: (documentId, rawText) => {
    set((state) => {
      const nextDocuments = state.document.documents.map((document) =>
        document.id === documentId
          ? updateDocumentSessionText(document, rawText)
          : document
      );
      const nextActiveDocument =
        state.document.activeDocument?.id === documentId
          ? (nextDocuments.find((document) => document.id === documentId) ??
            null)
          : state.document.activeDocument;
      const nextTabs = state.tabs.tabs.map((tab) =>
        tab.id === documentId
          ? {
              ...tab,
              isDirty:
                nextDocuments.find((document) => document.id === documentId)
                  ?.saveState !== "idle"
            }
          : tab
      );

      return {
        document: {
          activeDocument: nextActiveDocument,
          documents: nextDocuments
        },
        tabs: {
          ...state.tabs,
          tabs: nextTabs
        }
      };
    });
    get().commands.commandHandlers.updateDocumentText(documentId, rawText);
  },

  updatePaneSizes: (paneSizes) => {
    set((state) => ({
      layout: {
        ...state.layout,
        paneSizes
      }
    }));
    get().commands.commandHandlers.updatePaneSizes(paneSizes);
  },

  triggerToggleMode: () => {
    get().commands.commandHandlers.toggleMode();
  }
}));
