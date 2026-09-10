import { useEffect, type RefObject } from "react";
import {
  commandRegistry,
  isEditorCommandId,
  commandExecuted
} from "@pluma/commands";
import type { EditorCommandId, MarkdownCommandId } from "@pluma/commands";
import type { RichEditorHandle, SourceEditorHandle } from "@pluma/editor";
import { registerQuickAccessEditorTarget } from "./quickAccessEditorTarget.js";

export function useEditorQuickAccessAdapter(options: {
  documentId: string | null;
  activeTabId: string;
  mode: "source" | "rich" | "preview";
  source: RefObject<SourceEditorHandle | null>;
  rich: RefObject<RichEditorHandle | null>;
  onSearch(command: EditorCommandId): void;
}) {
  useEffect(() => {
    const { documentId, activeTabId, mode, source, rich, onSearch } = options;
    if (!documentId || documentId !== activeTabId) return;
    const editor = () => (mode === "rich" ? rich.current : source.current);
    return registerQuickAccessEditorTarget({
      documentId,
      editable: mode !== "preview",
      focus: () => {
        if (mode === "preview")
          document.querySelector<HTMLElement>(".preview-pane")?.focus();
        else editor()?.focus();
      },
      token: () => editor()?.getStateToken(),
      execute: (command) => {
        if (isEditorCommandId(command)) {
          onSearch(command);
          return commandExecuted;
        }
        if (
          mode === "preview" ||
          commandRegistry[command].route !== "editor" ||
          !editor()?.runCommand(command as MarkdownCommandId)
        )
          return { status: "unavailable", reason: "The editor is not ready." };
        editor()?.focus();
        return commandExecuted;
      }
    });
  }, [
    options.documentId,
    options.activeTabId,
    options.mode,
    options.source,
    options.rich,
    options.onSearch
  ]);
}
