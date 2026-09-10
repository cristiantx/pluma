import type { CommandDefinition } from "./commandTypes.js";

export const workspaceCommands = {
  "workspace-new-file": {
    label: "New File",
    route: "workspace",
    availability: "always",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-new-directory": {
    label: "New Directory",
    route: "workspace",
    availability: "always",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-copy": {
    label: "Copy",
    route: "workspace",
    availability: "always",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-cut": {
    label: "Cut",
    route: "workspace",
    availability: "always",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-paste": {
    label: "Paste",
    route: "workspace",
    availability: "canPaste",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-rename": {
    label: "Rename",
    route: "workspace",
    availability: "always",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-trash": {
    label: "Move To Trash",
    route: "workspace",
    availability: "always",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-find-in-folder": {
    label: "Find In Folder",
    route: "workspace",
    availability: "canFindInFolder",
    payload: "workspace",
    flush: true,
    palette: false
  },
  "workspace-show-in-folder": {
    label: "Show In Folder",
    route: "workspace",
    availability: "always",
    payload: "workspace",
    flush: true,
    palette: false
  }
} as const satisfies Record<string, CommandDefinition>;
