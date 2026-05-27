import { create } from "zustand";

import { resolveThemePreference } from "../theme.js";
import type {
  PlumaCommandHandlers,
  PlumaStoreInitializer,
  PlumaShellSnapshot,
  PlumaStore
} from "./plumaStoreTypes.js";

const noop = () => {};

const defaultCommandHandlers: PlumaCommandHandlers = {
  openFile: noop,
  openFolder: noop,
  toggleMode: noop
};

export const initialPlumaStoreState: PlumaStoreInitializer = {
  commands: {
    commandHandlers: defaultCommandHandlers
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
    workspaceLabel: "No workspace open",
    workspacePath: "~/Documents/Pluma Docs"
  }
};

export const usePlumaStore = create<PlumaStore>()((set, get) => ({
  ...initialPlumaStoreState,

  closeTab: (tabId) => {
    set((state) => {
      const nextTabs = state.tabs.tabs.filter((tab) => tab.id !== tabId);
      const nextActiveTabId =
        state.tabs.activeTabId === tabId
          ? (nextTabs[0]?.id ?? "")
          : state.tabs.activeTabId;

      return {
        tabs: {
          activeTabId: nextActiveTabId,
          tabs: nextTabs
        }
      };
    });
  },

  hydrateShellSnapshot: (snapshot: PlumaShellSnapshot) => {
    set((state) => {
      const nextTabs =
        state.tabs.tabs.length > 0 ? state.tabs.tabs : snapshot.tabs;
      const nextActiveTabId = nextTabs.some(
        (tab) => tab.id === state.tabs.activeTabId
      )
        ? state.tabs.activeTabId
        : (nextTabs[0]?.id ?? "");

      return {
        status: {
          statusMetrics: snapshot.statusMetrics
        },
        tabs: {
          activeTabId: nextActiveTabId,
          tabs: nextTabs
        },
        workspace: {
          explorerNodes: snapshot.explorerNodes,
          hasWorkspace: snapshot.hasWorkspace,
          isBridgeAvailable: snapshot.isBridgeAvailable,
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

  setActiveTabId: (tabId) => {
    set((state) => ({
      tabs: {
        ...state.tabs,
        activeTabId: tabId
      }
    }));
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

  triggerOpenFile: () => {
    get().commands.commandHandlers.openFile();
  },

  triggerOpenFolder: () => {
    get().commands.commandHandlers.openFolder();
  },

  triggerToggleMode: () => {
    get().commands.commandHandlers.toggleMode();
  }
}));
