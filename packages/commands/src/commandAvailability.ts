import { commandRegistry, type CommandId } from "./commandRegistry.js";
import type { CommandContext, CommandDefinition } from "./commandTypes.js";

export function getCommandState(id: CommandId, context: CommandContext) {
  const definition: CommandDefinition = commandRegistry[id];
  return {
    enabled:
      definition.availability === "always" ||
      context[definition.availability] === true,
    visible:
      definition.availability !== "isDevelopment" ||
      context.isDevelopment === true,
    checked: definition.checkedSetting
      ? context[definition.checkedSetting] === true
      : undefined
  };
}
