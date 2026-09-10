import {
  commandRegistry,
  isCommandId,
  type CommandRequest
} from "./commandRegistry.js";

export function parseCommandRequest(value: unknown): CommandRequest | null {
  if (typeof value === "string") value = { id: value };
  if (!isRecord(value) || !isCommandId(value.id)) return null;
  const { id, args } = value;
  if (Object.keys(value).some((key) => key !== "id" && key !== "args"))
    return null;
  const payload = commandRegistry[id].payload;
  if (payload === "none")
    return args === undefined ? ({ id } as CommandRequest) : null;
  if (!isRecord(args)) return null;
  let valid = false;
  switch (payload) {
    case "enabled":
      valid = keysEqual(args, ["enabled"]) && typeof args.enabled === "boolean";
      break;
    case "lineEnding":
      valid =
        keysEqual(args, ["target"]) &&
        (args.target === "lf" || args.target === "crlf");
      break;
    case "tab":
      valid =
        keysEqual(args, ["tabId", "tabIds"]) &&
        typeof args.tabId === "string" &&
        Array.isArray(args.tabIds) &&
        args.tabIds.every((item) => typeof item === "string");
      break;
    case "workspace":
      valid =
        keysEqual(args, ["path", "kind"]) &&
        typeof args.path === "string" &&
        (args.kind === "file" || args.kind === "folder");
      break;
  }
  return valid ? ({ id, args } as CommandRequest) : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keysEqual(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
