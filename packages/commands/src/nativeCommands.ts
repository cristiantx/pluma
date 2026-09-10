import type { CommandDefinition } from "./commandTypes.js";

const nativeCommand = <
  Role extends NonNullable<CommandDefinition["nativeRole"]>
>(
  label: string,
  nativeRole: Role,
  shortcut?: CommandDefinition["shortcut"]
) =>
  ({
    label,
    route: "native",
    availability: "always",
    payload: "none",
    flush: false,
    palette: false,
    nativeRole,
    ...(shortcut ? { shortcut } : {})
  }) as const satisfies CommandDefinition;

export const nativeCommands = {
  "native-undo": nativeCommand("Undo", "undo", {
    key: "Z",
    modifiers: ["Mod"]
  }),
  "native-redo": nativeCommand("Redo", "redo", {
    key: "Z",
    modifiers: ["Shift", "Mod"]
  }),
  "native-cut": nativeCommand("Cut", "cut", { key: "X", modifiers: ["Mod"] }),
  "native-copy": nativeCommand("Copy", "copy", {
    key: "C",
    modifiers: ["Mod"]
  }),
  "native-paste": nativeCommand("Paste", "paste", {
    key: "V",
    modifiers: ["Mod"]
  }),
  "native-pasteAndMatchStyle": nativeCommand(
    "Paste as Plain Text",
    "pasteAndMatchStyle",
    { key: "V", modifiers: ["Shift", "Mod"] }
  ),
  "native-selectAll": nativeCommand("Select All", "selectAll", {
    key: "A",
    modifiers: ["Mod"]
  }),
  "native-startSpeaking": nativeCommand("Start Dictation...", "startSpeaking"),
  "native-toggleDevTools": nativeCommand(
    "Toggle Developer Tools",
    "toggleDevTools"
  ),
  "native-minimize": nativeCommand("Minimize", "minimize"),
  "native-zoom": nativeCommand("Zoom", "zoom"),
  "native-front": nativeCommand("Bring All to Front", "front"),
  "native-close": nativeCommand("Close", "close"),
  "native-about": nativeCommand("About", "about"),
  "native-services": nativeCommand("Services", "services"),
  "native-hide": nativeCommand("Hide", "hide"),
  "native-hideOthers": nativeCommand("Hide Others", "hideOthers"),
  "native-unhide": nativeCommand("Show All", "unhide"),
  "native-quit": nativeCommand("Quit", "quit")
} as const satisfies Record<string, CommandDefinition>;
