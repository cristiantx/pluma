import {
  commandRegistry,
  getCommandState,
  getElectronAccelerator,
  type CommandContext,
  type CommandDefinition,
  type CommandId,
  type CommandPlatform,
  type CommandRequest
} from "@pluma/commands";
import type { MenuItemConstructorOptions } from "electron";

const explicitlyLabeledNativeCommands = new Set<CommandId>([
  "native-undo",
  "native-redo",
  "native-cut",
  "native-copy",
  "native-paste",
  "native-pasteAndMatchStyle",
  "native-selectAll",
  "native-startSpeaking"
]);

export function commandMenuItem(
  request: CommandRequest,
  context: CommandContext,
  onCommand: (command: CommandRequest) => void,
  platform: CommandPlatform
): MenuItemConstructorOptions {
  const definition: CommandDefinition = commandRegistry[request.id];
  const state = getCommandState(request.id, context);
  const accelerator = getElectronAccelerator(request.id, platform);
  const showNativeLabel =
    explicitlyLabeledNativeCommands.has(request.id) ||
    (request.id === "native-quit" && platform !== "darwin");

  return {
    ...(definition.nativeRole ? { role: definition.nativeRole } : {}),
    ...(!definition.nativeRole || showNativeLabel
      ? { label: definition.label }
      : {}),
    ...(accelerator ? { accelerator } : {}),
    enabled: state.enabled,
    visible: state.visible,
    ...(definition.checkedSetting
      ? {
          checked: state.checked === true,
          type: "checkbox" as const,
          click: (menuItem) => {
            onCommand({
              id: request.id,
              args: { enabled: menuItem.checked }
            } as CommandRequest);
          }
        }
      : definition.nativeRole
        ? {}
        : { click: () => onCommand(request) })
  };
}
