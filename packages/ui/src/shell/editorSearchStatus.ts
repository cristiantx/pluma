import type { EditorSearchStatus } from "@pluma/editor";

export function reconcileEditorSearchStatus(
  current: EditorSearchStatus,
  next: EditorSearchStatus
): EditorSearchStatus {
  return current.current === next.current &&
    current.total === next.total &&
    current.valid === next.valid
    ? current
    : next;
}
