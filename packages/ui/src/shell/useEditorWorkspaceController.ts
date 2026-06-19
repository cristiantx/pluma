import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type {
  EditorCursorAnchor,
  EditorKind,
  EditorScrollAnchor,
  EditorScrollSyncSource,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus,
  RichEditorHandle,
  SourceEditorHandle
} from "@pluma/editor";
import { createEmptyEditorSearchQuery } from "@pluma/editor";

type EditorWorkspaceControllerOptions = {
  activeDocumentId: string | null;
  editorViewMode: "rich" | "source" | "split";
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
  const latestCursorAnchorRef = useRef<EditorCursorAnchor | null>(null);
  const latestScrollAnchorRef = useRef<EditorScrollAnchor | null>(null);
  const mirrorFrameRef = useRef<number | null>(null);
  const [activeEditorKind, setActiveEditorKind] =
    useState<EditorKind>("source");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReplaceVisible, setIsReplaceVisible] = useState(true);
  const [searchPanelFocusRequestId, setSearchPanelFocusRequestId] = useState(0);
  const [searchQuery, setSearchQuery] = useState<EditorSearchQuery>(
    createEmptyEditorSearchQuery
  );
  const [searchStatus, setSearchStatus] = useState<EditorSearchStatus>(
    createEmptySearchStatus
  );

  const getActiveEditor = useCallback(() => {
    if (activeEditorKind === "rich" && showRichEditor) {
      return richEditorRef.current;
    }

    if (activeEditorKind === "source" && showSource) {
      return sourceEditorRef.current;
    }

    return showRichEditor ? richEditorRef.current : sourceEditorRef.current;
  }, [
    activeEditorKind,
    richEditorRef,
    showRichEditor,
    showSource,
    sourceEditorRef
  ]);

  const refreshSearchStatus = useCallback(() => {
    setSearchStatus(
      getActiveEditor()?.getSearchStatus() ?? createEmptySearchStatus()
    );
  }, [getActiveEditor]);

  const commitSearchQuery = useCallback(
    (query: EditorSearchQuery) => {
      setSearchQuery(query);
      richEditorRef.current?.setSearchQuery(query);
      sourceEditorRef.current?.setSearchQuery(query);
      window.requestAnimationFrame(refreshSearchStatus);
    },
    [refreshSearchStatus, richEditorRef, sourceEditorRef]
  );

  const closeSearchPanel = useCallback(() => {
    setIsSearchOpen(false);
    richEditorRef.current?.setSearchQuery(createEmptyEditorSearchQuery());
    sourceEditorRef.current?.setSearchQuery(createEmptyEditorSearchQuery());
    window.requestAnimationFrame(refreshSearchStatus);
  }, [refreshSearchStatus, richEditorRef, sourceEditorRef]);

  const runSearchCommand = useCallback(
    (
      command: "find-next" | "find-previous" | "replace-next" | "replace-all",
      options: EditorSearchActionOptions = {}
    ) => {
      const editor = getActiveEditor();

      if (!editor) {
        return;
      }

      editor.setSearchQuery(searchQuery);

      if (command === "find-next") {
        editor.findNext(options);
      } else if (command === "find-previous") {
        editor.findPrevious(options);
      } else if (command === "replace-next") {
        editor.replaceNext(options);
      } else {
        editor.replaceAll(options);
      }

      window.requestAnimationFrame(refreshSearchStatus);
    },
    [getActiveEditor, refreshSearchStatus, searchQuery]
  );

  const handleEditorCommand = useCallback(
    (command: unknown) => {
      if (command === "find") {
        setIsSearchOpen(true);
        richEditorRef.current?.setSearchQuery(searchQuery);
        sourceEditorRef.current?.setSearchQuery(searchQuery);
        setSearchPanelFocusRequestId((current) => current + 1);
        refreshSearchStatus();
        return;
      }

      if (command === "find-next") {
        runSearchCommand("find-next");
        return;
      }

      if (command === "find-previous") {
        runSearchCommand("find-previous");
        return;
      }

      if (command === "replace") {
        setIsSearchOpen(true);
        setIsReplaceVisible(true);
        richEditorRef.current?.setSearchQuery(searchQuery);
        sourceEditorRef.current?.setSearchQuery(searchQuery);
        setSearchPanelFocusRequestId((current) => current + 1);
        refreshSearchStatus();
      }
    },
    [
      refreshSearchStatus,
      richEditorRef,
      runSearchCommand,
      searchQuery,
      sourceEditorRef
    ]
  );

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
    const editorQuery = isSearchOpen
      ? searchQuery
      : createEmptyEditorSearchQuery();

    richEditorRef.current?.setSearchQuery(editorQuery);
    sourceEditorRef.current?.setSearchQuery(editorQuery);
    refreshSearchStatus();
  }, [
    activeDocumentId,
    refreshSearchStatus,
    richEditorRef,
    isSearchOpen,
    searchQuery,
    sourceEditorRef
  ]);

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
    commitSearchQuery,
    closeSearchPanel,
    handleCursorAnchorChange,
    handleEditorCommand,
    handleScrollAnchorChange,
    isReplaceVisible,
    isSearchOpen,
    refreshSearchStatus,
    runSearchCommand,
    searchQuery,
    searchPanelFocusRequestId,
    searchStatus,
    scheduleReplayAnchors,
    setActiveEditorKind,
    setIsReplaceVisible
  };
}

function createEmptySearchStatus(): EditorSearchStatus {
  return {
    current: 0,
    total: 0,
    valid: true
  };
}
