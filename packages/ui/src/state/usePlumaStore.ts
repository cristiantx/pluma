import { create } from "zustand";

import { updateDocumentSessionText } from "@pluma/core";

import { resolveThemePreference } from "../theme.js";
import type { AppSettings } from "../settings.js";
import { hydratePlumaShellSnapshot } from "./plumaStoreHydration.js";
import { initialPlumaStoreState } from "./plumaStoreInitialState.js";
import type { PlumaShellSnapshot, PlumaStore } from "./plumaStoreTypes.js";

export { initialPlumaStoreState } from "./plumaStoreInitialState.js";

export const usePlumaStore = create<PlumaStore>()((set, get) => ({
  ...initialPlumaStoreState,

  closeTab: (tabId) => {
    if (tabId === "settings") {
      get().closeSettingsTab();
      return;
    }

    const closeTabHandler = get().commands.commandHandlers.closeTab;
    closeTabHandler(tabId);
  },

  compareConflict: () => {
    get().commands.commandHandlers.compareConflict();
  },

  closeSettingsTab: () => {
    let nextActiveTabId = "";

    set((state) => {
      nextActiveTabId =
        state.tabs.activeTabId === "settings"
          ? (state.document.activeDocument?.id ?? "")
          : state.tabs.activeTabId;

      if (!state.tabs.tabs.some((tab) => tab.id === "settings")) {
        return state.tabs.activeTabId === "settings"
          ? {
              tabs: {
                activeTabId: nextActiveTabId,
                tabs: state.tabs.tabs
              }
            }
          : state;
      }

      const nextTabs = state.tabs.tabs.filter((tab) => tab.id !== "settings");
      nextActiveTabId =
        state.tabs.activeTabId === "settings"
          ? (state.document.activeDocument?.id ?? nextTabs[0]?.id ?? "")
          : state.tabs.activeTabId;

      return {
        tabs: {
          activeTabId: nextActiveTabId,
          tabs: nextTabs
        }
      };
    });

    if (nextActiveTabId) {
      get().commands.commandHandlers.setActiveTabId(nextActiveTabId);
    }
  },

  hydrateShellSnapshot: (snapshot: PlumaShellSnapshot) => {
    set((state) => hydratePlumaShellSnapshot(state, snapshot));
  },

  hydrateSettings: (settings: AppSettings) => {
    set((state) => ({
      settings,
      theme: {
        preference: settings.themePreference,
        resolvedTheme: resolveThemePreference(
          settings.themePreference,
          state.theme.systemPrefersDark
        ),
        systemPrefersDark: state.theme.systemPrefersDark
      },
      writing: {
        spellcheckEnabled: settings.spellcheckEnabled
      },
      workspace: {
        ...state.workspace,
        searchOptions: {
          caseSensitive: settings.workspaceSearchCaseSensitive,
          regexp: settings.workspaceSearchRegexp,
          wholeWord: settings.workspaceSearchWholeWord
        }
      }
    }));
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

  openSettingsTab: () => {
    set((state) => {
      const hasSettingsTab = state.tabs.tabs.some(
        (tab) => tab.id === "settings"
      );

      return {
        tabs: {
          activeTabId: "settings",
          tabs: hasSettingsTab
            ? state.tabs.tabs
            : [
                ...state.tabs.tabs,
                { id: "settings", kind: "settings", title: "Settings" }
              ]
        }
      };
    });
    get().commands.commandHandlers.setActiveTabId("settings");
  },

  openAppDataFolder: () => {
    get().commands.commandHandlers.openAppDataFolder();
  },

  openSettingsFile: () => {
    get().commands.commandHandlers.openSettingsFile();
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

  resetSettings: async () => {
    const nextSettings = await get().commands.commandHandlers.resetSettings();
    get().hydrateSettings(nextSettings);
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
    if (tabId === "settings") {
      set((state) => ({
        tabs: {
          ...state.tabs,
          activeTabId: "settings"
        }
      }));
      get().commands.commandHandlers.setActiveTabId(tabId);
      return;
    }

    set((state) => ({
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
        documentViewModes: state.document.activeDocument
          ? {
              ...state.layout.documentViewModes,
              [state.document.activeDocument.id]: mode
            }
          : state.layout.documentViewModes,
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
    get().commands.commandHandlers.showTabContextMenu(
      tabId,
      get().tabs.tabs.map((tab) => tab.id)
    );
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
    set((state) => ({
      settings: {
        ...state.settings,
        spellcheckEnabled: enabled
      },
      writing: {
        spellcheckEnabled: enabled
      }
    }));
  },

  setThemePreference: (preference) => {
    set((state) => ({
      settings: {
        ...state.settings,
        themePreference: preference
      },
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
        settings: {
          ...state.settings,
          themePreference: nextPreference
        },
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

  updateSettings: async (settings) => {
    const nextSettings =
      await get().commands.commandHandlers.updateSettings(settings);
    get().hydrateSettings(nextSettings);
  },

  triggerToggleMode: () => {
    get().commands.commandHandlers.toggleMode();
  }
}));
