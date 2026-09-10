import { createQuickAccessActions } from "./plumaQuickAccessState.js";
import { create } from "zustand";

import type { AppSettings } from "../settings.js";
import { updateDocumentTextState } from "./plumaDocumentState.js";
import { createEditorStateActions } from "./plumaEditorState.js";
import { initialPlumaStoreState } from "./plumaStoreInitialState.js";
import {
  activateDesktopDocumentState,
  hydrateDesktopDocumentViewModeState,
  hydrateDesktopWorkspaceState,
  openDesktopDocumentState,
  patchDesktopDocumentState
} from "./plumaDesktopState.js";
import type { PlumaStore } from "./plumaStoreTypes.js";
import {
  addNotification,
  removeNotification
} from "./plumaNotificationState.js";
import {
  hydrateSettingsState,
  setSpellcheckState,
  setSystemThemeState,
  setThemePreferenceState,
  toggleThemeState
} from "./plumaSettingsState.js";
import {
  activateDocumentTabState,
  closeSettingsTabState,
  openSettingsTabState,
  reorderTabsState
} from "./plumaTabState.js";
import {
  openWorkspaceSearchState,
  revealWorkspaceFileState,
  revealWorkspaceSearchMatchState,
  setWorkspaceSearchOptionsState,
  setWorkspaceSearchResultsState,
  toggleWorkspaceSearchResultFileState
} from "./plumaWorkspaceState.js";

export { initialPlumaStoreState } from "./plumaStoreInitialState.js";

export const usePlumaStore = create<PlumaStore>()((set, get) => ({
  ...initialPlumaStoreState,
  ...createEditorStateActions(set),
  ...createQuickAccessActions(set),

  closeTab: (tabId) => {
    if (tabId === "settings") {
      get().closeSettingsTab();
      return;
    }

    const closeTabHandler = get().commands.commandHandlers.closeTab;
    closeTabHandler(tabId);
  },

  closeSettingsTab: () => {
    let nextActiveTabId = "";

    set((state) => {
      const update = closeSettingsTabState(state);

      if (!update) {
        return state;
      }

      nextActiveTabId = update.nextActiveTabId;
      return { tabs: update.tabs };
    });

    if (nextActiveTabId) {
      get().commands.commandHandlers.setActiveTabId(nextActiveTabId);
    }
  },

  dismissNotification: (notificationId) => {
    set((state) => ({
      status: removeNotification(state.status, notificationId)
    }));
  },

  hydrateEditorViewMode: (mode) => {
    set((state) => ({
      layout: {
        ...state.layout,
        editorViewMode: mode
      }
    }));
  },

  hydrateActiveDocumentChange: (activeDocumentId, activeTabId, mode) => {
    set((state) =>
      activateDesktopDocumentState(state, activeDocumentId, activeTabId, mode)
    );
  },

  hydrateDesktopWorkspace: (workspace) => {
    set((state) => hydrateDesktopWorkspaceState(state, workspace));
  },

  hydrateDocumentOpened: (document, index, viewMode) => {
    set((state) => openDesktopDocumentState(state, document, index, viewMode));
  },

  hydrateDocumentPatch: (documentId, patch) => {
    set(
      (state) => patchDesktopDocumentState(state, documentId, patch) ?? state
    );
  },

  hydrateDocumentViewMode: (documentId, mode) => {
    set((state) =>
      hydrateDesktopDocumentViewModeState(state, documentId, mode)
    );
  },

  hydrateSettings: (settings: AppSettings) => {
    set((state) => hydrateSettingsState(state, settings));
  },

  reorderTabs: (tabs) => {
    set((state) => ({
      tabs: reorderTabsState(state, tabs)
    }));
  },

  keepEditing: () => {
    get().commands.commandHandlers.keepEditing();
  },

  openSettingsTab: () => {
    set((state) => ({ tabs: openSettingsTabState(state) }));
    get().commands.commandHandlers.setActiveTabId("settings");
  },

  openAppDataFolder: () => {
    get().commands.commandHandlers.openAppDataFolder();
  },

  openExternalUrl: (url) => {
    get().commands.commandHandlers.openExternalUrl(url);
  },

  openSettingsFile: () => {
    get().commands.commandHandlers.openSettingsFile();
  },

  openWorkspaceSearch: (folderPath) => {
    set((state) => ({
      workspace: openWorkspaceSearchState(state.workspace, folderPath)
    }));
  },

  pushNotification: (message, tone = "info") => {
    set((state) => ({
      status: addNotification(state.status, message, tone)
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
      workspace: revealWorkspaceFileState(state.workspace, path)
    }));
  },

  revealWorkspaceSearchMatch: (match) => {
    set((state) => ({
      workspace: revealWorkspaceSearchMatchState(state.workspace, match)
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
      workspace: setWorkspaceSearchOptionsState(state.workspace, options)
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
      workspace: setWorkspaceSearchResultsState(state.workspace, results)
    }));
  },

  toggleWorkspaceSearchResultFile: (filePath) => {
    set((state) => ({
      workspace: toggleWorkspaceSearchResultFileState(state.workspace, filePath)
    }));
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

    set((state) => activateDocumentTabState(state, tabId));
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
    set((state) => setSystemThemeState(state, matches));
  },

  setSpellcheckEnabled: (enabled) => {
    set((state) => setSpellcheckState(state, enabled));
  },

  setThemePreference: (preference) => {
    set((state) => setThemePreferenceState(state, preference));
  },

  toggleTheme: () => {
    set((state) => toggleThemeState(state));
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
    let didUpdateDocument = false;

    set((state) => {
      const update = updateDocumentTextState(state, documentId, rawText);

      if (!update) {
        return state;
      }

      didUpdateDocument = true;
      return update;
    });

    if (didUpdateDocument) {
      get().commands.commandHandlers.updateDocumentText(documentId, rawText);
    }
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
    set((state) => ({
      settings: {
        ...state.settings,
        ...settings
      }
    }));
    const nextSettings =
      await get().commands.commandHandlers.updateSettings(settings);
    get().hydrateSettings(nextSettings);
  },

  triggerToggleMode: () => {
    get().commands.commandHandlers.toggleMode();
  }
}));
