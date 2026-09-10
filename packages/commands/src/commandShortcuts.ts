import { commandRegistry, type CommandId } from "./commandRegistry.js";
import type { CommandDefinition, CommandPlatform } from "./commandTypes.js";

export function getCommandShortcut(id: CommandId, platform: CommandPlatform) {
  const definition: CommandDefinition = commandRegistry[id];
  return definition.platformShortcuts?.[platform] ?? definition.shortcut;
}
export function getElectronAccelerator(
  id: CommandId,
  platform: CommandPlatform
): string | undefined {
  const shortcut = getCommandShortcut(id, platform);
  return shortcut
    ? [
        ...shortcut.modifiers.map((modifier) =>
          modifier === "Mod" ? "CmdOrCtrl" : modifier
        ),
        shortcut.key
      ].join("+")
    : undefined;
}
export function getCodeMirrorBinding(
  id: CommandId,
  platform: CommandPlatform
): string | undefined {
  const shortcut = getCommandShortcut(id, platform);
  return shortcut
    ? [
        ...shortcut.modifiers.map((modifier) =>
          modifier === "Command" ? "Meta" : modifier
        ),
        shortcut.key.toLowerCase()
      ].join("-")
    : undefined;
}

export function getCommandShortcutLabel(
  id: CommandId,
  platform: CommandPlatform
): string {
  const shortcut = getCommandShortcut(id, platform);
  if (!shortcut) return "";
  const mac = platform === "darwin";
  const labels = {
    Mod: mac ? "⌘" : "Ctrl",
    Command: "⌘",
    Ctrl: mac ? "⌃" : "Ctrl",
    Shift: mac ? "⇧" : "Shift",
    Alt: mac ? "⌥" : "Alt"
  };
  return [
    ...shortcut.modifiers.map((modifier) => labels[modifier]),
    shortcut.key
  ].join(mac ? "" : "+");
}
