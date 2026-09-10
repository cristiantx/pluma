import type { CommandDefinition } from "./commandTypes.js";

export const applicationCommands = {
  "new-window": {
    label: "New Window",
    route: "application",
    availability: "always",
    payload: "none",
    flush: false,
    palette: true,
    shortcut: { key: "N", modifiers: ["Mod", "Shift"] }
  },
  "reload-window": {
    label: "Reload",
    route: "application",
    availability: "always",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "R", modifiers: ["Mod"] }
  },
  "force-reload-window": {
    label: "Force Reload",
    route: "application",
    availability: "always",
    payload: "none",
    flush: true,
    palette: true,
    shortcut: { key: "R", modifiers: ["Shift", "Mod"] }
  },
  "set-autosave-enabled": {
    label: "Auto Save",
    route: "application",
    availability: "always",
    payload: "enabled",
    flush: false,
    palette: true,
    checkedSetting: "autosaveEnabled"
  },
  "set-spellcheck-enabled": {
    label: "Check Spelling While Typing",
    route: "application",
    availability: "always",
    payload: "enabled",
    flush: false,
    palette: true,
    checkedSetting: "spellcheckEnabled"
  }
} as const satisfies Record<string, CommandDefinition>;
