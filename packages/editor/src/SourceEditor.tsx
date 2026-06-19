import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  bracketMatching,
  foldGutter,
  indentOnInput
} from "@codemirror/language";
import {
  findNext,
  findPrevious,
  openSearchPanel,
  search,
  searchKeymap
} from "@codemirror/search";
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
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { markdownCommandKeymap } from "./markdownCommands.js";
import { plumaSourceEditorTheme } from "./sourceEditorTheme.js";
import { createSourceSearchPanel } from "./SourceSearchPanel.js";

export type SourceEditorProps = {
  "aria-label"?: string;
  autoFocus?: boolean;
  documentId: string;
  onChange: (rawText: string) => void;
  rawText: string;
  searchRevealRequest?: SourceSearchRevealRequest | null;
  spellCheck?: boolean;
};

export type SourceEditorHandle = {
  find: () => void;
  findNext: () => void;
  findPrevious: () => void;
  replace: () => void;
  revealSearchMatch: (match: SourceSearchMatch) => void;
};

export type SourceSearchMatch = {
  line: number;
  matchEnd: number;
  matchStart: number;
};

export type SourceSearchRevealRequest = SourceSearchMatch & {
  requestId: number;
};

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor(
    {
      "aria-label": ariaLabel = "Markdown source editor",
      autoFocus = false,
      documentId,
      onChange,
      rawText,
      searchRevealRequest = null,
      spellCheck = true
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const onChangeRef = useRef(onChange);
    const viewRef = useRef<EditorView | null>(null);

    useImperativeHandle(ref, () => ({
      find: () => runSourceEditorCommand(viewRef.current, openSearchPanel),
      findNext: () => runSourceEditorCommand(viewRef.current, findNext),
      findPrevious: () => runSourceEditorCommand(viewRef.current, findPrevious),
      replace: () => runSourceEditorCommand(viewRef.current, openSearchPanel),
      revealSearchMatch: (match) =>
        revealSourceSearchMatch(viewRef.current, match)
    }));

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
      setSourceEditorSpellcheck(viewRef.current, spellCheck);
    }, [spellCheck]);

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

    useEffect(() => {
      if (!searchRevealRequest) {
        return;
      }

      revealSourceSearchMatch(viewRef.current, searchRevealRequest);
    }, [searchRevealRequest?.requestId]);

    return <div className="pluma-source-editor" ref={containerRef} />;
  }
);

function runSourceEditorCommand(
  view: EditorView | null,
  command: (view: EditorView) => boolean
): void {
  if (!view) {
    return;
  }

  command(view);
  view.focus();
}

function revealSourceSearchMatch(
  view: EditorView | null,
  match: SourceSearchMatch
): void {
  if (!view) {
    return;
  }

  if (
    !Number.isFinite(match.line) ||
    !Number.isFinite(match.matchStart) ||
    !Number.isFinite(match.matchEnd)
  ) {
    return;
  }

  const lineNumber = Math.max(1, Math.min(match.line, view.state.doc.lines));
  const line = view.state.doc.line(lineNumber);
  const matchStart = Math.max(0, Math.min(match.matchStart, match.matchEnd));
  const matchEnd = Math.max(match.matchStart, match.matchEnd);
  const from = Math.min(line.to, line.from + matchStart);
  const to = Math.min(line.to, line.from + Math.max(matchStart + 1, matchEnd));

  view.dispatch({
    effects: EditorView.scrollIntoView(from, { y: "center" }),
    selection: {
      anchor: from,
      head: to
    }
  });
  view.focus();
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
    search({
      createPanel: createSourceSearchPanel,
      top: true
    }),
    markdownCommandKeymap,
    keymap.of([...searchKeymap, ...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
    plumaSourceEditorTheme
  ];
}

function setSourceEditorSpellcheck(
  view: EditorView | null,
  enabled: boolean
): void {
  if (!view) {
    return;
  }

  const value = String(enabled);
  view.dom.setAttribute("spellcheck", value);
  view.contentDOM.setAttribute("spellcheck", value);
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
