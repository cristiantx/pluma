import { useCallback, useState } from "react";
import type { RefObject } from "react";

import type {
  EditorKind,
  EditorCursorAnchor,
  RichEditorHandle,
  SourceEditorHandle
} from "@pluma/editor";

import type { EditorViewMode } from "../state/plumaStoreTypes.js";
import { useEditorAnchorSync } from "./useEditorAnchorSync.js";
import { useEditorSearchController } from "./useEditorSearchController.js";

type EditorWorkspaceControllerOptions = {
  activeDocumentId: string | null;
  editorViewMode: EditorViewMode;
  richEditorRef: RefObject<RichEditorHandle | null>;
  showRichEditor: boolean;
  showSource: boolean;
  sourceEditorRef: RefObject<SourceEditorHandle | null>;
};

export function useEditorWorkspaceController({
  activeDocumentId,
  editorViewMode,
  richEditorRef,
  showRichEditor,
  showSource,
  sourceEditorRef
}: EditorWorkspaceControllerOptions) {
  const [activeEditorKind, setActiveEditorKind] =
    useState<EditorKind>("source");
  const searchController = useEditorSearchController({
    activeDocumentId,
    activeEditorKind,
    editorViewMode,
    richEditorRef,
    showRichEditor,
    showSource,
    sourceEditorRef
  });
  const anchorSync = useEditorAnchorSync({
    activeDocumentId,
    editorViewMode,
    richEditorRef,
    sourceEditorRef
  });

  const onEditorReady = useCallback(
    (kind: EditorKind) => {
      anchorSync.scheduleReplayAnchors();
      searchController.onEditorReady(kind);
    },
    [anchorSync.scheduleReplayAnchors, searchController.onEditorReady]
  );
  const handleCursorAnchorChange = useCallback(
    (anchor: EditorCursorAnchor) => {
      anchorSync.handleCursorAnchorChange(anchor);
      searchController.refreshSearchStatus();
    },
    [anchorSync.handleCursorAnchorChange, searchController.refreshSearchStatus]
  );
  return {
    ...searchController,
    ...anchorSync,
    handleCursorAnchorChange,
    onEditorReady,
    setActiveEditorKind
  };
}
