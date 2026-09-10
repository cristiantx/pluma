import { applicationCommands } from "./applicationCommands.js";
import { documentCommands } from "./documentCommands.js";
import { editorCommands } from "./editorCommands.js";
import { nativeCommands } from "./nativeCommands.js";
import { tabCommands } from "./tabCommands.js";
import { workspaceCommands } from "./workspaceCommands.js";
import type { CommandRoute, PayloadFor } from "./commandTypes.js";

export const commandRegistry = {
  ...applicationCommands,
  ...documentCommands,
  ...editorCommands,
  ...nativeCommands,
  ...tabCommands,
  ...workspaceCommands
} as const;
export type CommandId = keyof typeof commandRegistry;
export type CommandIdForRoute<R extends CommandRoute> = {
  [K in CommandId]: (typeof commandRegistry)[K]["route"] extends R ? K : never;
}[CommandId];
export type CommandRequestFor<K extends CommandId> =
  (typeof commandRegistry)[K]["payload"] extends "none"
    ? { id: K }
    : { id: K; args: PayloadFor<(typeof commandRegistry)[K]["payload"]> };
export type CommandRequest = {
  [K in CommandId]: CommandRequestFor<K>;
}[CommandId];
export type NoPayloadCommandId = {
  [K in CommandId]: (typeof commandRegistry)[K]["payload"] extends "none"
    ? K
    : never;
}[CommandId];
export type ShellCommandId = Extract<
  NoPayloadCommandId,
  CommandIdForRoute<"application" | "window" | "renderer">
>;
export type EditorCommandId = CommandIdForRoute<"renderer">;
export type MarkdownCommandId = CommandIdForRoute<"editor">;
export function isCommandId(value: unknown): value is CommandId {
  return typeof value === "string" && Object.hasOwn(commandRegistry, value);
}
export function isEditorCommandId(value: unknown): value is EditorCommandId {
  return isCommandId(value) && commandRegistry[value].route === "renderer";
}
