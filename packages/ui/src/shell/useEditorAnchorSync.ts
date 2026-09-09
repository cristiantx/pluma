import { useCallback, useEffect, useRef, type RefObject } from "react";
import type {
  EditorCursorAnchor,
  EditorScrollAnchor,
  RichEditorHandle,
  SourceEditorHandle
} from "@pluma/editor";
import type { EditorViewMode } from "../state/plumaStoreTypes.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

type EditorAnchorSyncOptions = {
  activeDocumentId: string | null;
  editorViewMode: EditorViewMode;
  richEditorRef: RefObject<RichEditorHandle | null>;
  sourceEditorRef: RefObject<SourceEditorHandle | null>;
};

export function useEditorAnchorSync({
  activeDocumentId,
  editorViewMode,
  richEditorRef,
  sourceEditorRef
}: EditorAnchorSyncOptions) {
  const frame = useRef<number | null>(null);
  const cancelReplay = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const handleCursorAnchorChange = useCallback((anchor: EditorCursorAnchor) => {
    usePlumaStore.getState().setEditorCursorAnchor(anchor);
  }, []);
  const handleScrollAnchorChange = useCallback((anchor: EditorScrollAnchor) => {
    usePlumaStore.getState().setEditorScrollAnchor(anchor);
  }, []);
  const scheduleReplayAnchors = useCallback(() => {
    cancelReplay();
    if (!activeDocumentId || editorViewMode === "preview") return;
    const snapshot = usePlumaStore.getState().editorSnapshots[activeDocumentId];
    if (!snapshot) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const editor =
        editorViewMode === "rich"
          ? richEditorRef.current
          : sourceEditorRef.current;
      if (snapshot.cursor) editor?.applyCursorAnchor(snapshot.cursor);
      if (snapshot.scroll) editor?.applyScrollAnchor(snapshot.scroll);
    });
  }, [
    activeDocumentId,
    cancelReplay,
    editorViewMode,
    richEditorRef,
    sourceEditorRef
  ]);
  useEffect(() => {
    for (const event of ["pointerdown", "keydown", "wheel"])
      window.addEventListener(event, cancelReplay, true);
    return () => {
      cancelReplay();
      for (const event of ["pointerdown", "keydown", "wheel"])
        window.removeEventListener(event, cancelReplay, true);
    };
  }, [activeDocumentId, editorViewMode, cancelReplay]);
  return {
    handleCursorAnchorChange,
    handleScrollAnchorChange,
    scheduleReplayAnchors
  };
}
