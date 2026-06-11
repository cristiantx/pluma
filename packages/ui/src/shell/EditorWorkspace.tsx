import { memo, useEffect, useRef } from "react";

import {
  RichEditor,
  SourceEditor,
  type SourceEditorHandle
} from "@pluma/editor";

import { EditorPaneLayout } from "../panes/EditorPaneLayout.js";
import { usePlumaStore } from "../state/usePlumaStore.js";
import { TabStrip } from "./TabStrip.js";

export const EditorWorkspace = memo(function EditorWorkspace() {
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const activeDocument = usePlumaStore(
    (state) => state.document.activeDocument
  );
  const editorViewMode = usePlumaStore((state) => state.layout.editorViewMode);
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const compareConflict = usePlumaStore((state) => state.compareConflict);
  const keepEditing = usePlumaStore((state) => state.keepEditing);
  const reloadFromDisk = usePlumaStore((state) => state.reloadFromDisk);
  const searchRevealRequest = usePlumaStore(
    (state) => state.workspace.searchRevealRequest
  );
  const splitPaneSizes = usePlumaStore(
    (state) =>
      state.layout.splitPaneSizesByDocumentId[state.tabs.activeTabId] ?? null
  );
  const updateDocumentText = usePlumaStore((state) => state.updateDocumentText);
  const updateSplitPaneSizes = usePlumaStore(
    (state) => state.updateSplitPaneSizes
  );

  useEffect(() => {
    const handleEditorCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const command = event.detail;

      if (command === "find") {
        sourceEditorRef.current?.find();
        return;
      }

      if (command === "find-next") {
        sourceEditorRef.current?.findNext();
        return;
      }

      if (command === "find-previous") {
        sourceEditorRef.current?.findPrevious();
        return;
      }

      if (command === "replace") {
        sourceEditorRef.current?.replace();
      }
    };

    window.addEventListener("pluma:editor-command", handleEditorCommand);

    return () => {
      window.removeEventListener("pluma:editor-command", handleEditorCommand);
    };
  }, []);

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

  const showRichEditor =
    activeDocument.capability === "rich-safe" &&
    (editorViewMode === "rich" || editorViewMode === "split");
  const showSource =
    editorViewMode === "source" ||
    editorViewMode === "split" ||
    activeDocument.capability === "source-only" ||
    !showRichEditor;
  const isSourceOnly = activeDocument.capability === "source-only";
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
  const richPane = showRichEditor ? (
    <article className="rich-pane" aria-label="Rich Markdown editor">
      <div className="rich-document">
        <RichEditor
          documentId={activeDocument.id}
          onChange={(rawText) => updateDocumentText(activeDocument.id, rawText)}
          rawText={activeDocument.rawText}
        />
      </div>
    </article>
  ) : null;
  const sourcePane = showSource ? (
    <article className="source-pane" aria-label="Markdown source">
      {isSourceOnly ? (
        <div className="source-only-notice" role="status">
          Source mode is preserving unsupported Markdown constructs.
        </div>
      ) : null}
      <SourceEditor
        documentId={activeDocument.id}
        onChange={(rawText) => updateDocumentText(activeDocument.id, rawText)}
        ref={sourceEditorRef}
        rawText={activeDocument.rawText}
        searchRevealRequest={sourceSearchRevealRequest}
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

      <div className="editor-panes" data-view-mode={editorViewMode}>
        {richPane && sourcePane ? (
          <EditorPaneLayout
            key={activeDocument.id}
            onPaneSizesChange={(paneSizes) =>
              updateSplitPaneSizes(activeDocument.id, paneSizes)
            }
            {...(splitPaneSizes ? { paneSizes: splitPaneSizes } : {})}
            rich={richPane}
            source={sourcePane}
          />
        ) : (
          (richPane ?? sourcePane)
        )}
      </div>
    </section>
  );
});
