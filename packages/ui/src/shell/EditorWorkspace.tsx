import { memo } from "react";

import { RichEditor, SourceEditor } from "@pluma/editor";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { TabStrip } from "./TabStrip.js";

export const EditorWorkspace = memo(function EditorWorkspace() {
  const activeDocument = usePlumaStore(
    (state) => state.document.activeDocument
  );
  const editorViewMode = usePlumaStore((state) => state.layout.editorViewMode);
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const updateDocumentText = usePlumaStore((state) => state.updateDocumentText);

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

  return (
    <section className="editor-workspace">
      <TabStrip />

      <div className="editor-panes" data-view-mode={editorViewMode}>
        {showRichEditor ? (
          <article className="rich-pane" aria-label="Rich Markdown editor">
            <div className="rich-document">
              <RichEditor
                documentId={activeDocument.id}
                onChange={(rawText) =>
                  updateDocumentText(activeDocument.id, rawText)
                }
                rawText={activeDocument.rawText}
              />
            </div>
          </article>
        ) : null}

        {showSource ? (
          <article className="source-pane" aria-label="Markdown source">
            {isSourceOnly ? (
              <div className="source-only-notice" role="status">
                Source mode is preserving unsupported Markdown constructs.
              </div>
            ) : null}
            <SourceEditor
              documentId={activeDocument.id}
              onChange={(rawText) =>
                updateDocumentText(activeDocument.id, rawText)
              }
              rawText={activeDocument.rawText}
            />
          </article>
        ) : null}
      </div>
    </section>
  );
});
