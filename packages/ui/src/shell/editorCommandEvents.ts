type EditorCommandEventTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export function addEditorCommandEventListener(
  onCommand: (command: EditorCommandId) => void,
  target: EditorCommandEventTarget = window
): () => void {
  const handleEditorCommandEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    if (isEditorCommandId(event.detail)) {
      onCommand(event.detail);
    }
  };

  target.addEventListener("pluma:editor-command", handleEditorCommandEvent);

  return () => {
    target.removeEventListener(
      "pluma:editor-command",
      handleEditorCommandEvent
    );
  };
}
import { isEditorCommandId, type EditorCommandId } from "@pluma/commands";
