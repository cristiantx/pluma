import { memo, useCallback, useEffect, useRef } from "react";

import {
  RichEditor,
  SourceEditor,
  type EditorCursorAnchor,
  type RichEditorHandle,
  type SourceEditorHandle
} from "@pluma/editor";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { addEditorCommandEventListener } from "./editorCommandEvents.js";
import { getDesktopDocumentAssetBaseUrl } from "./desktopAssetUrls.js";
import { EditorSearchPanel } from "./EditorSearchPanel.js";
import { findMarkdownHeadingAnchorPosition } from "./markdownHeadingAnchors.js";
import { getRichLinkTargetAction } from "./richLinkTargets.js";
import { SettingsView } from "./SettingsView.js";
import { TabStrip } from "./TabStrip.js";
import { useEditorWorkspaceController } from "./useEditorWorkspaceController.js";

type PendingLinkReveal = {
  filePath: string;
  fragment: string;
};

export const EditorWorkspace = memo(function EditorWorkspace() {
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
  const compareConflict = usePlumaStore((state) => state.compareConflict);
  const keepEditing = usePlumaStore((state) => state.keepEditing);
  const openExternalUrl = usePlumaStore((state) => state.openExternalUrl);
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
  const activeDocumentPath =
    activeDocument?.location.kind === "desktop-path"
      ? activeDocument.location.path
      : null;
  const showRichEditor =
    activeDocument?.modeConstraint !== "source-only" &&
    editorViewMode === "rich";
  const showSource =
    editorViewMode === "source" ||
    activeDocument?.modeConstraint === "source-only" ||
    !showRichEditor;
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
    scheduleReplayAnchors,
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
        <div className="editor-empty-state">
          <div className="editor-empty-copy">
            <h1>
              {hasWorkspace ? "Select a Markdown file" : "Welcome to Pluma"}
            </h1>
            <p>
              {hasWorkspace
                ? "Choose a file from the workspace tree to open a real document session."
                : "Pluma is ready for local-first Markdown files and folders."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const isSourceOnly = activeDocument.modeConstraint === "source-only";
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
          documentId={activeDocument.id}
          imageBaseUrl={imageBaseUrl}
          onCursorAnchorChange={handleCursorAnchorChange}
          onFocus={() => setActiveEditorKind("rich")}
          onOpenLinkRequest={handleOpenLinkRequest}
          onReady={scheduleReplayAnchors}
          onScrollAnchorChange={handleScrollAnchorChange}
          onChange={(rawText) => updateDocumentText(activeDocument.id, rawText)}
          ref={richEditorRef}
          rawText={activeDocument.rawText}
          resolvedTheme={resolvedTheme}
          searchRevealRequest={richSearchRevealRequest}
          spellCheck={spellcheckEnabled}
        />
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
        documentId={activeDocument.id}
        onCursorAnchorChange={handleCursorAnchorChange}
        onFocus={() => setActiveEditorKind("source")}
        onReady={scheduleReplayAnchors}
        onScrollAnchorChange={handleScrollAnchorChange}
        onChange={(rawText) => updateDocumentText(activeDocument.id, rawText)}
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
        <div
          className="save-conflict-banner"
          role="status"
          data-save-state={activeDocument.saveState}
        >
          <span>
            {activeDocument.saveState === "external-change"
              ? "This file changed on disk."
              : "This file has a save conflict."}
          </span>
          <div className="save-conflict-actions">
            <button onClick={reloadFromDisk} type="button">
              Reload
            </button>
            <button onClick={keepEditing} type="button">
              Keep Editing
            </button>
            <button onClick={compareConflict} type="button">
              Show Path
            </button>
          </div>
        </div>
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
        data-rich-density={richEditorDensity}
        data-rich-width={richEditorWidth}
        data-source-width={sourceEditorWidth}
      >
        {richPane ?? sourcePane}
      </div>
    </section>
  );
});
