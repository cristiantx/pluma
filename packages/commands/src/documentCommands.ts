import type { CommandDefinition } from "./commandTypes.js";

export const documentCommands = {
  "new-file": {
    label: "New File",
    route: "window",
    availability: "always",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "N", modifiers: ["Mod"] }
  },
  "open-file": {
    label: "Open File",
    route: "window",
    availability: "always",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "O", modifiers: ["Mod"] }
  },
  "open-folder": {
    label: "Open Folder",
    route: "window",
    availability: "always",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "O", modifiers: ["Mod", "Shift"] }
  },
  "open-settings": {
    label: "Settings...",
    route: "window",
    availability: "always",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: ",", modifiers: ["Mod"] }
  },
  save: {
    label: "Save",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "S", modifiers: ["Mod"] }
  },
  "save-as": {
    label: "Save As",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "S", modifiers: ["Mod", "Shift"] }
  },
  "export-html": {
    label: "Export as HTML...",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true
  },
  "export-pdf": {
    label: "Export as PDF...",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true
  },
  "close-active-tab": {
    label: "Close Tab",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "W", modifiers: ["Mod"] }
  },
  "convert-line-endings": {
    label: "Convert Line Endings To",
    route: "window",
    availability: "hasActiveDocument",
    payload: "lineEnding",
    flush: true,
    palette: true
  },
  "toggle-mode": {
    label: "Toggle Rich/Source Mode",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "\\", modifiers: ["Mod"] }
  },
  "open-devtools": {
    label: "Open DevTools",
    route: "window",
    availability: "isDevelopment",
    payload: "none",
    flush: true,
    palette: true,
    platformShortcuts: {
      darwin: { key: "I", modifiers: ["Alt", "Command"] },
      win32: { key: "I", modifiers: ["Ctrl", "Shift"] },
      linux: { key: "I", modifiers: ["Ctrl", "Shift"] }
    }
  },
  "keep-editing": {
    label: "Keep Editing",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true
  },
  "reload-from-disk": {
    label: "Reload from Disk",
    route: "window",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true
  }
} as const satisfies Record<string, CommandDefinition>;
