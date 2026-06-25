import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

import type {
  EditorCursorAnchor,
  EditorScrollAnchor,
  RichEditorHandle,
  SourceEditorHandle
} from "@pluma/editor";

import type { EditorViewMode } from "../state/plumaStoreTypes.js";

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
  const latestCursorAnchorRef = useRef<EditorCursorAnchor | null>(null);
  const latestScrollAnchorRef = useRef<EditorScrollAnchor | null>(null);

  const handleScrollAnchorChange = useCallback((anchor: EditorScrollAnchor) => {
    latestScrollAnchorRef.current = anchor;
  }, []);

  const handleCursorAnchorChange = useCallback((anchor: EditorCursorAnchor) => {
    latestCursorAnchorRef.current = anchor;
  }, []);

  const replayAnchors = useCallback(() => {
    if (editorViewMode === "preview") {
      return;
    }

    const scrollAnchor = latestScrollAnchorRef.current;
    const cursorAnchor = latestCursorAnchorRef.current;
    const hasScrollAnchor =
      scrollAnchor && scrollAnchor.documentId === activeDocumentId;
    const hasCursorAnchor =
      cursorAnchor && cursorAnchor.documentId === activeDocumentId;

    if (!hasScrollAnchor && !hasCursorAnchor) {
      return;
    }

    if (hasCursorAnchor && editorViewMode === "rich") {
      richEditorRef.current?.applyCursorAnchor(cursorAnchor);
      return;
    }

    if (hasCursorAnchor && editorViewMode === "source") {
      sourceEditorRef.current?.applyCursorAnchor(cursorAnchor);
      return;
    }

    if (!hasScrollAnchor) {
      return;
    }

    if (editorViewMode === "rich") {
      richEditorRef.current?.applyScrollAnchor(scrollAnchor);
    } else {
      sourceEditorRef.current?.applyScrollAnchor(scrollAnchor);
    }
  }, [activeDocumentId, editorViewMode, richEditorRef, sourceEditorRef]);

  const scheduleReplayAnchors = useCallback(() => {
    window.requestAnimationFrame(replayAnchors);
  }, [replayAnchors]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(replayAnchors);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [replayAnchors]);

  return {
    handleCursorAnchorChange,
    handleScrollAnchorChange,
    scheduleReplayAnchors
  };
}
