import { getCommandState } from "./commandAvailability.js";
import {
  commandRegistry,
  type CommandId,
  type CommandRequest
} from "./commandRegistry.js";
import { parseCommandRequest } from "./commandRequests.js";
import type { CommandContext, CommandDefinition } from "./commandTypes.js";

export type PaletteEntry = {
  key: string;
  commandId: CommandId;
  label: string;
  category: string;
  keywords: readonly string[];
  enabled: boolean;
  reason: string | null;
  checked: boolean | undefined;
  request: CommandRequest;
};

const unavailableReasons: Record<string, string> = {
  hasActiveDocument: "Open a document first.",
  canCloseActiveTab: "No tab is open.",
  canEditDocument: "Focus an editable document in Source or Rich mode.",
  canKeepEditing: "The document has no external change to resolve.",
  canReloadDocument: "Open a document saved on disk first.",
  isDevelopment: "Available in development builds."
};

export function getPaletteEntries(context: CommandContext): PaletteEntry[] {
  return (Object.keys(commandRegistry) as CommandId[])
    .flatMap((id) => {
      const definition: CommandDefinition = commandRegistry[id];
      const state = getCommandState(id, context);
      if (!definition.palette || !state.visible) return [];
      const requests: CommandRequest[] = [];
      if (definition.payload === "none") {
        const request = parseCommandRequest({ id });
        if (request) requests.push(request);
      } else if (id === "convert-line-endings") {
        requests.push(
          { id, args: { target: "lf" } },
          { id, args: { target: "crlf" } }
        );
      } else if (
        id === "set-autosave-enabled" ||
        id === "set-spellcheck-enabled"
      ) {
        requests.push({ id, args: { enabled: !state.checked } });
      }
      return requests.map((request): PaletteEntry => {
        const variant =
          request.id === "convert-line-endings" ? request.args.target : "";
        const toggle =
          request.id === "set-autosave-enabled" ||
          request.id === "set-spellcheck-enabled";
        return {
          key: variant ? `${id}:${variant}` : id,
          commandId: id,
          request,
          label: variant
            ? `${definition.label} ${variant.toUpperCase()}`
            : toggle
              ? `${state.checked ? "Disable" : "Enable"} ${definition.label}`
              : definition.label,
          category:
            definition.category ??
            (definition.route === "editor"
              ? "Format"
              : definition.route === "renderer"
                ? "Search"
                : definition.route === "application"
                  ? "Application"
                  : "Document"),
          keywords: definition.keywords ?? [],
          enabled: state.enabled,
          checked: state.checked,
          reason: state.enabled
            ? null
            : (unavailableReasons[definition.availability] ??
              "Unavailable in the current context.")
        };
      });
    })
    .sort(
      (a, b) =>
        Number(b.enabled) - Number(a.enabled) ||
        a.category.localeCompare(b.category) ||
        a.label.localeCompare(b.label)
    );
}
