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
  newFile: noop,
  openDevTools: noop,
  openFile: noop,
  openFolder: noop,
  openWorkspaceFile: noop,
  searchWorkspace: () => Promise.resolve([]),
  reloadFromDisk: noop,
  setActiveTabId: noop,
  setEditorViewMode: noop,
  showTabContextMenu: noop,
  showWorkspaceContextMenu: noop,
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
    paneSizes: [],
    splitPaneSizesByDocumentId: {}
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
  writing: {
    spellcheckEnabled: true
  },
  workspace: {
    explorerNodes: [],
    hasWorkspace: false,
    isBridgeAvailable: false,
    isDevelopment: false,
    revealRequestId: 0,
    revealWorkspacePath: null,
    collapsedSearchResultFiles: [],
    searchFolderPath: null,
    searchHasSearched: false,
    searchOptions: {
      caseSensitive: false,
      regexp: false,
      wholeWord: false
    },
    searchQuery: "",
    searchRevealRequest: null,
    searchResults: [],
    searchRequestId: 0,
    sidebarView: "workspace",
    workspaceLabel: "No workspace open",
    workspacePath: "~/Documents/Pluma Docs"
  }
};

export const usePlumaStore = create<PlumaStore>()((set, get) => ({
  ...initialPlumaStoreState,

  closeTab: (tabId) => {
    const closeTabHandler = get().commands.commandHandlers.closeTab;
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
      const openDocumentIds = new Set(
        snapshot.documents.map((document) => document.id)
      );
      const splitPaneSizesByDocumentId = Object.fromEntries(
        Object.entries(state.layout.splitPaneSizesByDocumentId).filter(
          ([documentId]) => openDocumentIds.has(documentId)
        )
      );

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
          activeTabId: snapshot.activeDocumentId ?? "",
          tabs: snapshot.tabs
        },
        workspace: {
          explorerNodes: snapshot.explorerNodes,
          hasWorkspace: snapshot.hasWorkspace,
          isBridgeAvailable: snapshot.isBridgeAvailable,
          isDevelopment: snapshot.isDevelopment,
          revealRequestId: state.workspace.revealRequestId,
          revealWorkspacePath: state.workspace.revealWorkspacePath,
          collapsedSearchResultFiles:
            state.workspace.collapsedSearchResultFiles,
          searchFolderPath: state.workspace.searchFolderPath,
          searchHasSearched: state.workspace.searchHasSearched,
          searchOptions: state.workspace.searchOptions,
          searchQuery: state.workspace.searchQuery,
          searchRevealRequest: state.workspace.searchRevealRequest,
          searchResults: state.workspace.searchResults,
          searchRequestId: state.workspace.searchRequestId,
          sidebarView: state.workspace.sidebarView,
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

  openWorkspaceSearch: (folderPath) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        searchFolderPath: folderPath,
        searchRequestId: state.workspace.searchRequestId + 1,
        sidebarView: "search"
      }
    }));
  },

  reloadFromDisk: () => {
    get().commands.commandHandlers.reloadFromDisk();
  },

  revealWorkspaceFile: (path) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        revealRequestId: state.workspace.revealRequestId + 1,
        revealWorkspacePath: path
      }
    }));
  },

  revealWorkspaceSearchMatch: (match) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        searchRevealRequest: {
          match,
          requestId: (state.workspace.searchRevealRequest?.requestId ?? 0) + 1
        }
      }
    }));
  },

  setWorkspaceSearchHasSearched: (hasSearched) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        searchHasSearched: hasSearched
      }
    }));
  },

  setWorkspaceSearchOptions: (options) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        searchOptions: options
      }
    }));
  },

  setWorkspaceSearchQuery: (query) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        searchQuery: query
      }
    }));
  },

  setWorkspaceSearchResults: (results) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        collapsedSearchResultFiles:
          state.workspace.collapsedSearchResultFiles.filter((filePath) =>
            results.some((result) => result.filePath === filePath)
          ),
        searchResults: results
      }
    }));
  },

  toggleWorkspaceSearchResultFile: (filePath) => {
    set((state) => {
      const isCollapsed =
        state.workspace.collapsedSearchResultFiles.includes(filePath);

      return {
        workspace: {
          ...state.workspace,
          collapsedSearchResultFiles: isCollapsed
            ? state.workspace.collapsedSearchResultFiles.filter(
                (candidate) => candidate !== filePath
              )
            : [...state.workspace.collapsedSearchResultFiles, filePath]
        }
      };
    });
  },

  triggerNewFile: () => {
    get().commands.commandHandlers.newFile();
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
      },
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

  setSidebarView: (view) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        sidebarView: view
      }
    }));
  },

  showTabContextMenu: (tabId) => {
    get().commands.commandHandlers.showTabContextMenu(tabId);
  },

  showWorkspaceContextMenu: (path, kind) => {
    get().commands.commandHandlers.showWorkspaceContextMenu(path, kind);
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

  setSpellcheckEnabled: (enabled) => {
    set({
      writing: {
        spellcheckEnabled: enabled
      }
    });
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

  updateSplitPaneSizes: (documentId, paneSizes) => {
    set((state) => ({
      layout: {
        ...state.layout,
        splitPaneSizesByDocumentId: {
          ...state.layout.splitPaneSizesByDocumentId,
          [documentId]: paneSizes
        }
      }
    }));
  },

  triggerToggleMode: () => {
    get().commands.commandHandlers.toggleMode();
  }
}));
