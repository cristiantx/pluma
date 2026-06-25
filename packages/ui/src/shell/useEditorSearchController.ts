import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type {
  EditorKind,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus,
  RichEditorHandle,
  SourceEditorHandle
} from "@pluma/editor";
import { createEmptyEditorSearchQuery } from "@pluma/editor";

import { usePlumaStore } from "../state/usePlumaStore.js";

type SearchCommand =
  | "find-next"
  | "find-previous"
  | "replace-next"
  | "replace-all";

type DeferredSearchCommand = {
  command: SearchCommand;
  options: EditorSearchActionOptions;
};

type EditorSearchControllerOptions = {
  activeDocumentId: string | null;
  activeEditorKind: EditorKind;
  editorViewMode: "source" | "rich" | "preview";
  richEditorRef: RefObject<RichEditorHandle | null>;
  showRichEditor: boolean;
  showSource: boolean;
  sourceEditorRef: RefObject<SourceEditorHandle | null>;
};

export function useEditorSearchController({
  activeDocumentId,
  activeEditorKind,
  editorViewMode,
  richEditorRef,
  showRichEditor,
  showSource,
  sourceEditorRef
}: EditorSearchControllerOptions) {
  const setEditorViewMode = usePlumaStore((state) => state.setEditorViewMode);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReplaceVisible, setIsReplaceVisible] = useState(true);
  const [searchPanelFocusRequestId, setSearchPanelFocusRequestId] = useState(0);
  const [searchQuery, setSearchQuery] = useState<EditorSearchQuery>(
    createEmptyEditorSearchQuery
  );
  const [searchStatus, setSearchStatus] = useState<EditorSearchStatus>(
    createEmptySearchStatus
  );
  const deferredSearchCommandRef = useRef<DeferredSearchCommand | null>(null);

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

  const ensureSourceSearchMode = useCallback(() => {
    if (editorViewMode !== "preview") {
      return false;
    }

    setEditorViewMode("source");
    return true;
  }, [editorViewMode, setEditorViewMode]);

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
    (command: SearchCommand, options: EditorSearchActionOptions = {}) => {
      if (ensureSourceSearchMode()) {
        deferredSearchCommandRef.current = { command, options };
        return;
      }

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
    [ensureSourceSearchMode, getActiveEditor, refreshSearchStatus, searchQuery]
  );

  useEffect(() => {
    if (editorViewMode === "preview") {
      return;
    }

    const deferredCommand = deferredSearchCommandRef.current;

    if (!deferredCommand) {
      return;
    }

    deferredSearchCommandRef.current = null;
    window.requestAnimationFrame(() => {
      runSearchCommand(deferredCommand.command, deferredCommand.options);
    });
  }, [editorViewMode, runSearchCommand]);

  const handleEditorCommand = useCallback(
    (command: unknown) => {
      if (command === "find") {
        ensureSourceSearchMode();
        setIsSearchOpen(true);
        setIsReplaceVisible(false);
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
        ensureSourceSearchMode();
        setIsSearchOpen(true);
        setIsReplaceVisible(true);
        richEditorRef.current?.setSearchQuery(searchQuery);
        sourceEditorRef.current?.setSearchQuery(searchQuery);
        setSearchPanelFocusRequestId((current) => current + 1);
        refreshSearchStatus();
      }
    },
    [
      ensureSourceSearchMode,
      refreshSearchStatus,
      richEditorRef,
      runSearchCommand,
      searchQuery,
      sourceEditorRef
    ]
  );

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

  return {
    closeSearchPanel,
    commitSearchQuery,
    handleEditorCommand,
    isReplaceVisible,
    isSearchOpen,
    refreshSearchStatus,
    runSearchCommand,
    searchPanelFocusRequestId,
    searchQuery,
    searchStatus,
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
