import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  bracketMatching,
  foldGutter,
  indentOnInput
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { useEffect, useRef } from "react";

import { markdownCommandKeymap } from "./markdownCommands.js";
import { plumaSourceEditorTheme } from "./sourceEditorTheme.js";

export type SourceEditorProps = {
  "aria-label"?: string;
  autoFocus?: boolean;
  documentId: string;
  onChange: (rawText: string) => void;
  rawText: string;
};

export function SourceEditor({
  "aria-label": ariaLabel = "Markdown source editor",
  autoFocus = false,
  documentId,
  onChange,
  rawText
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const parent = containerRef.current;

    if (!parent) {
      return;
    }

    const view = new EditorView({
      doc: rawText,
      extensions: createSourceEditorExtensions((nextText) => {
        onChangeRef.current(nextText);
      }),
      parent
    });

    view.dom.setAttribute("aria-label", ariaLabel);
    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [ariaLabel, autoFocus, documentId]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view || view.state.doc.toString() === rawText) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: rawText
      }
    });
  }, [rawText]);

  return <div className="pluma-source-editor" ref={containerRef} />;
}

function createSourceEditorExtensions(
  onChange: (rawText: string) => void
): Extension[] {
  return [
    lineNumbers(),
    foldGutter({
      markerDOM: createFoldMarker
    }),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    markdown(),
    markdownCommandKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
    plumaSourceEditorTheme
  ];
}

function createFoldMarker(isOpen: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "pluma-fold-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.innerHTML = isOpen
    ? '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>';

  return marker;
}
