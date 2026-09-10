import { useRef } from "react";
import {
  commandRegistry,
  getPaletteEntries,
  type EditorCommandId,
  type MarkdownCommandId
} from "@pluma/commands";
import { usePlumaStore } from "../../state/usePlumaStore.js";
import {
  quickAccessContext,
  quickAccessInvocationContext
} from "./quickAccessContext.js";
import { getQuickAccessEditorTarget } from "./quickAccessEditorTarget.js";

export function useQuickAccessExecution(
  restore: (destination?: boolean) => void
) {
  const locked = useRef(false);
  return async (id: string, forceCommand = false) => {
    if (locked.current) return;
    const state = usePlumaStore.getState();
    const mode = forceCommand ? "commands" : state.quickAccess.mode;
    const services = state.commands.quickAccess;
    const entry =
      mode === "commands"
        ? getPaletteEntries(quickAccessContext(state)).find(
            (item) => item.key === id
          )
        : null;
    const file =
      mode === "files"
        ? state.quickAccess.results.find((item) => item.candidate.id === id)
            ?.candidate
        : null;
    if (entry && !entry.enabled) {
      state.updateQuickAccess({ error: entry.reason });
      return;
    }
    if (!entry && (!file || state.quickAccess.busy)) return;
    if (!services) {
      state.updateQuickAccess({ error: "Desktop commands are unavailable." });
      return;
    }
    if (
      entry?.commandId === "quick-open" ||
      entry?.commandId === "command-palette"
    ) {
      state.openQuickAccess(
        entry.commandId === "quick-open" ? "files" : "commands"
      );
      return;
    }
    const context = quickAccessInvocationContext(state);
    const openingId = state.quickAccess.openingId;
    const target = getQuickAccessEditorTarget();
    const editorToken = target?.token();
    const previousMode = state.quickAccess.mode;
    locked.current = true;
    state.updateQuickAccess({ executing: true });
    state.closeQuickAccess();
    try {
      let result;
      const route = entry ? commandRegistry[entry.commandId].route : null;
      if (entry && (route === "editor" || route === "renderer")) {
        result = await services.flush();
        if (result.status === "executed") {
          const current = getQuickAccessEditorTarget();
          if (
            !target ||
            current !== target ||
            current.documentId !== context.documentId ||
            current.token() !== editorToken
          )
            result = {
              status: "unavailable" as const,
              reason: "The document changed. Open the palette and try again."
            };
          else
            result = current.execute(
              entry.commandId as EditorCommandId | MarkdownCommandId
            );
        }
      } else if (entry) result = await services.execute(entry.request, context);
      else if (file)
        result = await services.activate(
          file.documentId
            ? { kind: "open-document", documentId: file.documentId }
            : {
                kind: "workspace-file",
                path: file.path!,
                workspaceGeneration: context.workspaceGeneration
              }
        );
      else return;
      const latest = usePlumaStore.getState();
      if (latest.quickAccess.openingId !== openingId || latest.quickAccess.mode)
        return;
      if (result.status === "failed" || result.status === "unavailable") {
        latest.updateQuickAccess({
          mode: previousMode,
          error: result.status === "failed" ? result.message : result.reason,
          focusRequestId: latest.quickAccess.focusRequestId + 1
        });
      } else if (result.status === "cancelled") restore();
      else if (file || (entry && route !== "renderer" && route !== "editor"))
        restore(Boolean(file));
    } catch (error) {
      const latest = usePlumaStore.getState();
      if (
        latest.quickAccess.openingId === openingId &&
        !latest.quickAccess.mode
      )
        latest.updateQuickAccess({
          mode: previousMode,
          error: error instanceof Error ? error.message : "The action failed."
        });
    } finally {
      locked.current = false;
      usePlumaStore.getState().updateQuickAccess({ executing: false });
    }
  };
}
