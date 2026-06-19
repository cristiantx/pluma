type EditorCommandEventTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export function addEditorCommandEventListener(
  onCommand: (command: unknown) => void,
  target: EditorCommandEventTarget = window
): () => void {
  const handleEditorCommandEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    onCommand(event.detail);
  };

  target.addEventListener("pluma:editor-command", handleEditorCommandEvent);

  return () => {
    target.removeEventListener(
      "pluma:editor-command",
      handleEditorCommandEvent
    );
  };
}
