import type { CommandDefinition } from "./commandTypes.js";

export const tabCommands = {
  "tab-close": {
    label: "Close",
    route: "tab",
    availability: "always",
    payload: "tab",
    flush: true,
    palette: false
  },
  "tab-close-others": {
    label: "Close others",
    route: "tab",
    availability: "canCloseOthers",
    payload: "tab",
    flush: true,
    palette: false
  },
  "tab-close-saved": {
    label: "Close saved tabs",
    route: "tab",
    availability: "canCloseSavedTabs",
    payload: "tab",
    flush: true,
    palette: false
  },
  "tab-close-all": {
    label: "Close all tabs",
    route: "tab",
    availability: "canCloseAll",
    payload: "tab",
    flush: true,
    palette: false
  },
  "tab-rename": {
    label: "Rename",
    route: "tab",
    availability: "canRename",
    payload: "tab",
    flush: true,
    palette: false
  },
  "tab-copy-path": {
    label: "Copy path",
    route: "tab",
    availability: "canCopyPath",
    payload: "tab",
    flush: true,
    palette: false
  },
  "tab-show-in-folder": {
    label: "Show in folder",
    route: "tab",
    availability: "canShowInFolder",
    payload: "tab",
    flush: true,
    palette: false
  },
  "tab-reveal-in-workspace": {
    label: "Reveal in Workspace",
    route: "tab",
    availability: "canRevealInWorkspace",
    payload: "tab",
    flush: true,
    palette: false
  }
} as const satisfies Record<string, CommandDefinition>;
