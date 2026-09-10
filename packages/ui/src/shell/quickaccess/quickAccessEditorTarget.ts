import type {
  CommandExecutionResult,
  EditorCommandId,
  MarkdownCommandId
} from "@pluma/commands";

export type QuickAccessEditorTarget = {
  documentId: string;
  editable: boolean;
  focus(): void;
  token(): unknown;
  execute(command: EditorCommandId | MarkdownCommandId): CommandExecutionResult;
};

// A window-local imperative target. Editor views and selections never enter shared state.
let target: QuickAccessEditorTarget | null = null;
export function registerQuickAccessEditorTarget(
  next: QuickAccessEditorTarget
): () => void {
  target = next;
  return () => {
    if (target === next) target = null;
  };
}
export function getQuickAccessEditorTarget(): QuickAccessEditorTarget | null {
  return target;
}
