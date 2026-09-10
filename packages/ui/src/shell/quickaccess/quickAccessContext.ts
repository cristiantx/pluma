import type { CommandContext, CommandInvocationContext } from "@pluma/commands";
import type { PlumaStore } from "../../state/plumaStoreTypes.js";

export function quickAccessContext(state: PlumaStore): CommandContext {
  const document =
    state.tabs.activeTabId === state.document.activeDocument?.id
      ? state.document.activeDocument
      : null;
  return {
    hasActiveDocument: Boolean(document),
    canCloseActiveTab: Boolean(state.tabs.activeTabId),
    canEditDocument: Boolean(
      document &&
      (document.modeConstraint === "source-only" ||
        state.layout.editorViewMode !== "preview")
    ),
    canKeepEditing:
      document?.saveState === "conflict" ||
      document?.saveState === "external-change",
    canReloadDocument: document?.location.kind === "desktop-path",
    isDevelopment: state.workspace.isDevelopment,
    autosaveEnabled: state.settings.autosaveEnabled,
    spellcheckEnabled: state.writing.spellcheckEnabled
  };
}
export function quickAccessInvocationContext(
  state: PlumaStore
): CommandInvocationContext {
  return {
    activeTabId: state.tabs.activeTabId || null,
    documentId:
      state.tabs.activeTabId === state.document.activeDocument?.id
        ? state.document.activeDocument.id
        : null,
    workspaceGeneration: state.workspace.workspaceIndex?.generation ?? 0
  };
}
