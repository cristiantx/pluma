import { useEditorQuickAccessAdapter } from "./quickaccess/useEditorQuickAccessAdapter.js";
import { memo, useCallback, useEffect, useRef } from "react";

import {
  EditorSessionController,
  PreviewView,
  RichEditor,
  SourceEditor,
  type EditorCursorAnchor,
  type PreviewViewProps,
  type RichEditorHandle,
  type SourceEditorHandle
} from "@pluma/editor";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { addEditorCommandEventListener } from "./editorCommandEvents.js";
import { getDesktopDocumentAssetBaseUrl } from "./desktopAssetUrls.js";
import { EditorSearchPanel } from "./EditorSearchPanel.js";
import { EditorEmptyState } from "./EditorEmptyState.js";
import { findMarkdownHeadingAnchorPosition } from "./markdownHeadingAnchors.js";
import { getRichLinkTargetAction } from "./richLinkTargets.js";
import { SettingsView } from "./SettingsView.js";
import { SaveConflictBanner } from "./SaveConflictBanner.js";
import { EDITOR_TAB_PANEL_ID, getTabButtonId } from "./tabAccessibility.js";
import { TabStrip } from "./TabStrip.js";
import { useEditorWorkspaceController } from "./useEditorWorkspaceController.js";

type PendingLinkReveal = {
  filePath: string;
  fragment: string;
};

export const EditorWorkspace = memo(function EditorWorkspace() {
  const sessions = useRef(new EditorSessionController()).current;
  const openDocuments = usePlumaStore((state) => state.document.documents);
  useEffect(
    () => sessions.retain(openDocuments.map((document) => document.id)),
    [openDocuments, sessions]
  );
  const richEditorRef = useRef<RichEditorHandle | null>(null);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const pendingLinkRevealRef = useRef<PendingLinkReveal | null>(null);
  const activeDocument = usePlumaStore(
    (state) => state.document.activeDocument
  );
  const activeTabId = usePlumaStore((state) => state.tabs.activeTabId);
  const editorViewMode = usePlumaStore((state) => state.layout.editorViewMode);
  const richEditorDensity = usePlumaStore(
    (state) => state.settings.richEditorDensity
  );
  const richEditorWidth = usePlumaStore(
    (state) => state.settings.richEditorWidth
  );
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const sourceEditorWidth = usePlumaStore(
    (state) => state.settings.sourceEditorWidth
  );
  const sourceEditorFontFamily = usePlumaStore(
    (state) => state.settings.sourceEditorFontFamily
  );
  const sourceEditorColorScheme = usePlumaStore(
    (state) => state.settings.sourceEditorColorScheme
  );
  const sourceEditorFontSize = usePlumaStore(
    (state) => state.settings.sourceEditorFontSize
  );
  const sourceEditorLineNumbers = usePlumaStore(
    (state) => state.settings.sourceEditorLineNumbers
  );
  const sourceEditorTabSize = usePlumaStore(
    (state) => state.settings.sourceEditorTabSize
  );
  const sourceEditorWordWrap = usePlumaStore(
    (state) => state.settings.sourceEditorWordWrap
  );
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const workspacePath = usePlumaStore((state) => state.workspace.workspacePath);
  const keepEditing = usePlumaStore((state) => state.keepEditing);
  const openExternalUrl = usePlumaStore((state) => state.openExternalUrl);
  const pushNotification = usePlumaStore((state) => state.pushNotification);
  const reloadFromDisk = usePlumaStore((state) => state.reloadFromDisk);
  const searchRevealRequest = usePlumaStore(
    (state) => state.workspace.searchRevealRequest
  );
  const spellcheckEnabled = usePlumaStore(
    (state) => state.writing.spellcheckEnabled
  );
  const triggerOpenWorkspaceFile = usePlumaStore(
    (state) => state.triggerOpenWorkspaceFile
  );
  const updateDocumentText = usePlumaStore((state) => state.updateDocumentText);
  const activeDocumentId = activeDocument?.id ?? null;
  const baselineRevision = usePlumaStore((state) =>
    activeDocumentId
      ? (state.editorSnapshots[activeDocumentId]?.baselineRevision ?? 0)
      : 0
  );
  const activeDocumentPath =
    activeDocument?.location.kind === "desktop-path"
      ? activeDocument.location.path
      : null;
  const isSourceOnly = activeDocument?.modeConstraint === "source-only";
  const showPreview = !isSourceOnly && editorViewMode === "preview";
  const showRichEditor = !isSourceOnly && editorViewMode === "rich";
  const showSource = editorViewMode === "source" || isSourceOnly;
  const {
    closeSearchPanel,
    commitSearchQuery,
    handleCursorAnchorChange,
    handleEditorCommand,
    handleScrollAnchorChange,
    isReplaceVisible,
    isSearchOpen,
    runSearchCommand,
    searchQuery,
    searchPanelFocusRequestId,
    searchStatus,
    onEditorReady,
    setActiveEditorKind,
    setIsReplaceVisible
  } = useEditorWorkspaceController({
    activeDocumentId,
    editorViewMode,
    richEditorRef,
    showRichEditor,
    showSource,
    sourceEditorRef
  });

  useEditorQuickAccessAdapter({
    documentId: activeDocumentId,
    activeTabId,
    mode: isSourceOnly ? "source" : editorViewMode,
    source: sourceEditorRef,
    rich: richEditorRef,
    onSearch: handleEditorCommand
  });

  const revealPendingLinkAnchor = useCallback(() => {
    const pendingReveal = pendingLinkRevealRef.current;

    if (
      !pendingReveal ||
      !activeDocument ||
      activeDocument.location.kind !== "desktop-path" ||
      activeDocument.location.path !== pendingReveal.filePath
    ) {
      return;
    }

    const position = findMarkdownHeadingAnchorPosition(
      activeDocument.rawText,
      pendingReveal.fragment
    );
    pendingLinkRevealRef.current = null;

    if (position === null) {
      return;
    }

    const anchor: EditorCursorAnchor = {
      documentId: activeDocument.id,
      kind: "source",
      position,
      visibleOffset: null
    };

    window.requestAnimationFrame(() => {
      if (editorViewMode === "rich") {
        richEditorRef.current?.applyCursorAnchor(anchor);
      } else {
        sourceEditorRef.current?.applyCursorAnchor(anchor);
      }
    });
  }, [activeDocument, editorViewMode]);

  const handleOpenLinkRequest = useCallback(
    (linkUrl: string) => {
      const action = getRichLinkTargetAction({
        activeDocumentPath,
        linkUrl,
        workspacePath: hasWorkspace ? workspacePath : null
      });

      if (action.kind === "external-url") {
        openExternalUrl(action.url);
        return;
      }

      if (action.kind !== "workspace-markdown") {
        return;
      }

      pendingLinkRevealRef.current = action.fragment
        ? {
            filePath: action.filePath,
            fragment: action.fragment
          }
        : null;
      triggerOpenWorkspaceFile(action.filePath);

      if (action.filePath === activeDocumentPath && action.fragment) {
        window.requestAnimationFrame(revealPendingLinkAnchor);
      }
    },
    [
      activeDocumentPath,
      hasWorkspace,
      openExternalUrl,
      revealPendingLinkAnchor,
      triggerOpenWorkspaceFile,
      workspacePath
    ]
  );
  const handleRichEditorFocus = useCallback(() => {
    setActiveEditorKind("rich");
  }, [setActiveEditorKind]);
  const handleSourceEditorFocus = useCallback(() => {
    setActiveEditorKind("source");
  }, [setActiveEditorKind]);
  const handleDocumentTextChange = useCallback(
    (rawText: string) => {
      if (activeDocumentId) {
        updateDocumentText(activeDocumentId, rawText);
      }
    },
    [activeDocumentId, updateDocumentText]
  );
  const handleEditorLoadError = useCallback(
    (error: Error) => {
      pushNotification(error.message, "error");
    },
    [pushNotification]
  );

  useEffect(() => {
    return addEditorCommandEventListener(handleEditorCommand);
  }, [handleEditorCommand]);

  useEffect(() => {
    revealPendingLinkAnchor();
  }, [revealPendingLinkAnchor]);

  if (activeTabId === "settings") {
    return (
      <section className="editor-workspace">
        <TabStrip />
        <SettingsView />
      </section>
    );
  }

  if (!activeDocument) {
    return (
      <section className="editor-workspace">
        <TabStrip />
        <EditorEmptyState hasWorkspace={hasWorkspace} />
      </section>
    );
  }

  const sourceSearchRevealRequest =
    searchRevealRequest &&
    showSource &&
    activeDocument.location.kind === "desktop-path" &&
    activeDocument.location.path === searchRevealRequest.match.filePath
      ? {
          line: searchRevealRequest.match.line,
          matchEnd: searchRevealRequest.match.matchEnd,
          matchStart: searchRevealRequest.match.matchStart,
          requestId: searchRevealRequest.requestId
        }
      : null;
  const richSearchRevealRequest =
    searchRevealRequest &&
    showRichEditor &&
    activeDocument.location.kind === "desktop-path" &&
    activeDocument.location.path === searchRevealRequest.match.filePath
      ? {
          line: searchRevealRequest.match.line,
          matchEnd: searchRevealRequest.match.matchEnd,
          matchStart: searchRevealRequest.match.matchStart,
          requestId: searchRevealRequest.requestId
        }
      : null;
  const imageBaseUrl =
    activeDocument.location.kind === "desktop-path"
      ? getDesktopDocumentAssetBaseUrl(activeDocument.location.path)
      : undefined;
  const richPane = showRichEditor ? (
    <article className="rich-pane" aria-label="Rich Markdown editor">
      <div className="rich-document">
        <RichEditor
          sessionController={sessions}
          baselineRevision={baselineRevision}
          documentId={activeDocument.id}
          imageBaseUrl={imageBaseUrl}
          onCursorAnchorChange={handleCursorAnchorChange}
          onError={handleEditorLoadError}
          onFocus={handleRichEditorFocus}
          onOpenLinkRequest={handleOpenLinkRequest}
          onReady={() => onEditorReady("rich")}
          onScrollAnchorChange={handleScrollAnchorChange}
          onChange={handleDocumentTextChange}
          ref={richEditorRef}
          rawText={activeDocument.rawText}
          resolvedTheme={resolvedTheme}
          searchRevealRequest={richSearchRevealRequest}
          spellCheck={spellcheckEnabled}
        />
      </div>
    </article>
  ) : null;
  const previewProps: PreviewViewProps = {
    documentId: activeDocument.id,
    imageBaseUrl,
    onError: handleEditorLoadError,
    onOpenLinkRequest: handleOpenLinkRequest,
    rawText: activeDocument.rawText,
    resolvedTheme
  };
  const previewPane = showPreview ? (
    <article
      className="preview-pane"
      aria-label="Markdown preview"
      tabIndex={-1}
    >
      <div className="preview-document">
        <PreviewView {...previewProps} />
      </div>
    </article>
  ) : null;
  const sourcePane = showSource ? (
    <article
      className="source-pane"
      data-source-color-scheme={sourceEditorColorScheme}
      aria-label="Markdown source"
    >
      {isSourceOnly ? (
        <div className="source-only-notice" role="status">
          Source mode is preserving unsupported Markdown constructs.
        </div>
      ) : null}
      <SourceEditor
        sessionController={sessions}
        baselineRevision={baselineRevision}
        documentId={activeDocument.id}
        onCursorAnchorChange={handleCursorAnchorChange}
        onFocus={handleSourceEditorFocus}
        onReady={() => onEditorReady("source")}
        onScrollAnchorChange={handleScrollAnchorChange}
        onChange={handleDocumentTextChange}
        ref={sourceEditorRef}
        rawText={activeDocument.rawText}
        searchRevealRequest={sourceSearchRevealRequest}
        sourceFontFamily={sourceEditorFontFamily}
        sourceFontSize={sourceEditorFontSize}
        sourceLineNumbers={sourceEditorLineNumbers}
        sourceTabSize={sourceEditorTabSize}
        sourceWordWrap={sourceEditorWordWrap}
        spellCheck={spellcheckEnabled}
      />
    </article>
  ) : null;

  return (
    <section className="editor-workspace">
      <TabStrip />

      {activeDocument.saveState === "conflict" ||
      activeDocument.saveState === "external-change" ? (
        <SaveConflictBanner
          onKeepEditing={keepEditing}
          onReload={reloadFromDisk}
          saveState={activeDocument.saveState}
        />
      ) : null}

      {isSearchOpen ? (
        <EditorSearchPanel
          focusRequestId={searchPanelFocusRequestId}
          isReplaceVisible={isReplaceVisible}
          onClose={closeSearchPanel}
          onFindNext={() =>
            runSearchCommand("find-next", { focusEditor: false })
          }
          onFindPrevious={() =>
            runSearchCommand("find-previous", { focusEditor: false })
          }
          onQueryChange={commitSearchQuery}
          onReplaceAll={() =>
            runSearchCommand("replace-all", { focusEditor: false })
          }
          onReplaceNext={() =>
            runSearchCommand("replace-next", { focusEditor: false })
          }
          onReplaceVisibilityChange={setIsReplaceVisible}
          query={searchQuery}
          status={searchStatus}
        />
      ) : null}

      <div
        className="editor-panes"
        role="tabpanel"
        id={EDITOR_TAB_PANEL_ID}
        aria-labelledby={activeTabId ? getTabButtonId(activeTabId) : undefined}
        data-rich-density={richEditorDensity}
        data-rich-width={richEditorWidth}
        data-source-width={sourceEditorWidth}
      >
        {previewPane ?? richPane ?? sourcePane}
      </div>
    </section>
  );
});
