import { memo } from "react";

import { getFileLocationName } from "@pluma/core";
import { SourceEditor } from "@pluma/editor";

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

  const previewBlocks = buildPreviewBlocks(activeDocument.rawText);
  const showPreview = editorViewMode === "rich" || editorViewMode === "split";
  const showSource = editorViewMode === "source" || editorViewMode === "split";

  return (
    <section className="editor-workspace">
      <TabStrip />

      <div className="editor-panes" data-view-mode={editorViewMode}>
        {showPreview ? (
          <article className="preview-pane" aria-label="Preview">
            <div className="preview-document">
              <div className="preview-meta">
                <span>{getFileLocationName(activeDocument.location)}</span>
                <span>{activeDocument.saveState}</span>
              </div>
              {previewBlocks.map((block) => {
                switch (block.kind) {
                  case "heading1":
                    return <h1 key={block.key}>{block.text}</h1>;
                  case "heading2":
                    return <h2 key={block.key}>{block.text}</h2>;
                  case "rule":
                    return <hr key={block.key} />;
                  case "list":
                    return (
                      <ul key={block.key}>
                        {block.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    );
                  case "quote":
                    return (
                      <blockquote key={block.key}>
                        {block.lines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </blockquote>
                    );
                  case "code":
                    return (
                      <pre key={block.key}>
                        <code>{block.code}</code>
                      </pre>
                    );
                  case "paragraph":
                    return <p key={block.key}>{block.text}</p>;
                }
              })}
            </div>
          </article>
        ) : null}

        {showSource ? (
          <article className="source-pane" aria-label="Markdown source">
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

type PreviewBlock =
  | { key: string; kind: "heading1"; text: string }
  | { key: string; kind: "heading2"; text: string }
  | { key: string; kind: "paragraph"; text: string }
  | { items: string[]; key: string; kind: "list" }
  | { key: string; kind: "rule" }
  | { key: string; kind: "code"; code: string }
  | { key: string; kind: "quote"; lines: string[] };

function buildPreviewBlocks(rawText: string): PreviewBlock[] {
  const blocks = rawText.split(/\n{2,}/);

  return blocks.map((block, index) => {
    const trimmedBlock = block.trim();

    if (!trimmedBlock) {
      return {
        key: `paragraph-${index}`,
        kind: "paragraph",
        text: ""
      };
    }

    if (trimmedBlock.startsWith("# ")) {
      return {
        key: `heading1-${index}`,
        kind: "heading1",
        text: trimmedBlock.slice(2).trim()
      };
    }

    if (trimmedBlock.startsWith("## ")) {
      return {
        key: `heading2-${index}`,
        kind: "heading2",
        text: trimmedBlock.slice(3).trim()
      };
    }

    if (trimmedBlock === "---") {
      return {
        key: `rule-${index}`,
        kind: "rule"
      };
    }

    if (trimmedBlock.startsWith("```") && trimmedBlock.endsWith("```")) {
      return {
        code: trimmedBlock.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, ""),
        key: `code-${index}`,
        kind: "code"
      };
    }

    if (trimmedBlock.startsWith(">")) {
      return {
        key: `quote-${index}`,
        kind: "quote",
        lines: trimmedBlock
          .split(/\r?\n/)
          .map((line) => line.replace(/^>\s?/, "").trim())
          .filter(Boolean)
      };
    }

    if (trimmedBlock.startsWith("- ")) {
      return {
        items: trimmedBlock
          .split(/\r?\n/)
          .map((line) => line.replace(/^- /, "").trim())
          .filter(Boolean),
        key: `list-${index}`,
        kind: "list"
      };
    }

    return {
      key: `paragraph-${index}`,
      kind: "paragraph",
      text: trimmedBlock
    };
  });
}
