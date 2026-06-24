import { memo, useEffect, useRef } from "react";

import {
  RichEditor,
  SourceEditor,
  type RichEditorHandle,
  type SourceEditorHandle
} from "@pluma/editor";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { addEditorCommandEventListener } from "./editorCommandEvents.js";
import { EditorSearchPanel } from "./EditorSearchPanel.js";
import { SettingsView } from "./SettingsView.js";
import { TabStrip } from "./TabStrip.js";
import { useEditorWorkspaceController } from "./useEditorWorkspaceController.js";

export const EditorWorkspace = memo(function EditorWorkspace() {
  const richEditorRef = useRef<RichEditorHandle | null>(null);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
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
  const compareConflict = usePlumaStore((state) => state.compareConflict);
  const keepEditing = usePlumaStore((state) => state.keepEditing);
  const reloadFromDisk = usePlumaStore((state) => state.reloadFromDisk);
  const searchRevealRequest = usePlumaStore(
    (state) => state.workspace.searchRevealRequest
  );
  const spellcheckEnabled = usePlumaStore(
    (state) => state.writing.spellcheckEnabled
  );
  const updateDocumentText = usePlumaStore((state) => state.updateDocumentText);
  const activeDocumentId = activeDocument?.id ?? null;
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

  useEffect(() => {
    return addEditorCommandEventListener(handleEditorCommand);
  }, [handleEditorCommand]);

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
  const richPane = showRichEditor ? (
    <article className="rich-pane" aria-label="Rich Markdown editor">
      <div className="rich-document">
        <RichEditor
          documentId={activeDocument.id}
          onCursorAnchorChange={handleCursorAnchorChange}
          onFocus={() => setActiveEditorKind("rich")}
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
