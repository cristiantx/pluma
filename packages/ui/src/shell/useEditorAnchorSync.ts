import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

import type {
  EditorCursorAnchor,
  EditorKind,
  EditorScrollAnchor,
  EditorScrollSyncSource,
  RichEditorHandle,
  SourceEditorHandle
} from "@pluma/editor";

type EditorAnchorSyncOptions = {
  activeDocumentId: string | null;
  editorViewMode: "rich" | "source" | "split";
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
  const mirrorFrameRef = useRef<number | null>(null);

  const handleScrollAnchorChange = useCallback(
    (
      kind: EditorKind,
      anchor: EditorScrollAnchor,
      source: EditorScrollSyncSource
    ) => {
      latestScrollAnchorRef.current = anchor;

      if (
        editorViewMode !== "split" ||
        source !== "user" ||
        mirrorFrameRef.current !== null
      ) {
        return;
      }

      mirrorFrameRef.current = window.requestAnimationFrame(() => {
        mirrorFrameRef.current = null;

        if (kind === "source") {
          richEditorRef.current?.applyScrollAnchor(anchor);
          return;
        }

        sourceEditorRef.current?.applyScrollAnchor(anchor);
      });
    },
    [editorViewMode, richEditorRef, sourceEditorRef]
  );

  const handleCursorAnchorChange = useCallback((anchor: EditorCursorAnchor) => {
    latestCursorAnchorRef.current = anchor;
  }, []);

  const replayAnchors = useCallback(() => {
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
    } else if (editorViewMode === "source") {
      sourceEditorRef.current?.applyScrollAnchor(scrollAnchor);
    } else {
      richEditorRef.current?.applyScrollAnchor(scrollAnchor);
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

  useEffect(() => {
    return () => {
      if (mirrorFrameRef.current !== null) {
        window.cancelAnimationFrame(mirrorFrameRef.current);
      }
    };
  }, []);

  return {
    handleCursorAnchorChange,
    handleScrollAnchorChange,
    scheduleReplayAnchors
  };
}
