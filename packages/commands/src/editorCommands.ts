import type { CommandDefinition } from "./commandTypes.js";

export const editorCommands = {
  find: {
    label: "Find",
    route: "renderer",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "F", modifiers: ["Mod"] }
  },
  "find-next": {
    label: "Find Next",
    route: "renderer",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "G", modifiers: ["Mod"] }
  },
  "find-previous": {
    label: "Find Previous",
    route: "renderer",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "G", modifiers: ["Shift", "Mod"] }
  },
  replace: {
    label: "Replace",
    route: "renderer",
    availability: "hasActiveDocument",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "F", modifiers: ["Alt", "Mod"] }
  },
  "toggle-bold": {
    label: "Bold",
    route: "editor",
    availability: "hasActiveDocument",
    payload: "none",
    flush: false,
    palette: true,
    shortcut: { key: "B", modifiers: ["Mod"] }
  },
  "toggle-italic": {
    label: "Italic",
    route: "editor",
    availability: "hasActiveDocument",
    payload: "none",
    flush: false,
    palette: true,
    shortcut: { key: "I", modifiers: ["Mod"] }
  },
  "toggle-heading-1": {
    label: "Heading 1",
    route: "editor",
    availability: "hasActiveDocument",
    payload: "none",
    flush: false,
    palette: true,
    shortcut: { key: "1", modifiers: ["Mod", "Alt"] }
  },
  "toggle-heading-2": {
    label: "Heading 2",
    route: "editor",
    availability: "hasActiveDocument",
    payload: "none",
    flush: false,
    palette: true,
    shortcut: { key: "2", modifiers: ["Mod", "Alt"] }
  },
  "toggle-heading-3": {
    label: "Heading 3",
    route: "editor",
    availability: "hasActiveDocument",
    payload: "none",
    flush: false,
    palette: true,
    shortcut: { key: "3", modifiers: ["Mod", "Alt"] }
  }
} as const satisfies Record<string, CommandDefinition>;
