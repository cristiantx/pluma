import type {
  PlumaCommandHandlers,
  PlumaStoreInitializer
} from "./plumaStoreTypes.js";
import { defaultAppSettings } from "../settings.js";

const noop = () => {};

export const defaultCommandHandlers: PlumaCommandHandlers = {
  closeTab: noop,
  compareConflict: noop,
  keepEditing: noop,
  newFile: noop,
  openDevTools: noop,
  openFile: noop,
  openFolder: noop,
  openWorkspaceFile: noop,
  searchWorkspace: () => Promise.resolve([]),
  updateSettings: () => Promise.resolve(defaultAppSettings),
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
  settings: defaultAppSettings,
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
