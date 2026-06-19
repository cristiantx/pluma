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
  replaceAll,
  replaceNext,
  search
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
import type { RefObject } from "react";

import type {
  EditorCursorAnchor,
  EditorScrollSyncSource
} from "./editorTypes.js";
import { markdownCommandKeymap } from "./markdownCommands.js";
import { plumaSourceEditorTheme } from "./sourceEditorTheme.js";
import { sourceSearchDecorations } from "./sourceSearchDecorations.js";
import {
  applySourceCursorAnchor,
  applySourceScrollAnchor,
  getSourceCursorAnchor,
  getSourceScrollAnchor,
  getSourceSearchStatus,
  revealSourceSearchMatch,
  runSourceEditorCommand,
  setSourceSearchQuery
} from "./sourceEditorInterop.js";
import type {
  SourceEditorHandle,
  SourceEditorProps
} from "./sourceEditorTypes.js";

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor(
    {
      "aria-label": ariaLabel = "Markdown source editor",
      autoFocus = false,
      documentId,
      onCursorAnchorChange,
      onFocus,
      onReady,
      onScrollAnchorChange,
      onChange,
      rawText,
      searchRevealRequest = null,
      spellCheck = true
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const onCursorAnchorChangeRef = useRef(onCursorAnchorChange);
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onReadyRef = useRef(onReady);
    const onScrollAnchorChangeRef = useRef(onScrollAnchorChange);
    const scrollSourceRef = useRef<EditorScrollSyncSource>("user");
    const viewRef = useRef<EditorView | null>(null);

    useImperativeHandle(ref, () => ({
      findNext: (options) =>
        runSourceEditorCommand(viewRef.current, findNext, options),
      findPrevious: (options) =>
        runSourceEditorCommand(viewRef.current, findPrevious, options),
      focus: () => viewRef.current?.focus(),
      getCursorAnchor: () => getSourceCursorAnchor(viewRef.current, documentId),
      getScrollAnchor: () => getSourceScrollAnchor(viewRef.current, documentId),
      getSearchStatus: () => getSourceSearchStatus(viewRef.current),
      applyCursorAnchor: (anchor) =>
        applySourceCursorAnchor(viewRef.current, anchor),
      applyScrollAnchor: (anchor) => {
        scrollSourceRef.current = "programmatic";
        applySourceScrollAnchor(viewRef.current, anchor);
        window.requestAnimationFrame(() => {
          scrollSourceRef.current = "user";
        });
      },
      replaceAll: (options) =>
        runSourceEditorCommand(viewRef.current, replaceAll, options),
      replaceNext: (options) =>
        runSourceEditorCommand(viewRef.current, replaceNext, options),
      revealSearchMatch: (match) =>
        revealSourceSearchMatch(viewRef.current, match),
      setSearchQuery: (query) => setSourceSearchQuery(viewRef.current, query)
    }));

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onCursorAnchorChangeRef.current = onCursorAnchorChange;
      onFocusRef.current = onFocus;
      onReadyRef.current = onReady;
      onScrollAnchorChangeRef.current = onScrollAnchorChange;
    }, [onCursorAnchorChange, onFocus, onReady, onScrollAnchorChange]);

    useEffect(() => {
      const parent = containerRef.current;

      if (!parent) {
        return;
      }

      const view = new EditorView({
        doc: rawText,
        extensions: createSourceEditorExtensions(
          (nextText) => {
            onChangeRef.current(nextText);
          },
          (updatedView) => {
            emitSourceCursorAnchor(
              updatedView,
              documentId,
              onCursorAnchorChangeRef
            );
          }
        ),
        parent
      });

      view.dom.setAttribute("aria-label", ariaLabel);
      viewRef.current = view;
      onReadyRef.current?.();

      const handleFocusIn = () => {
        onFocusRef.current?.();
        emitSourceCursorAnchor(view, documentId, onCursorAnchorChangeRef);
      };
      const handleSelectionChange = () => {
        emitSourceCursorAnchor(view, documentId, onCursorAnchorChangeRef);
      };
      const handleScroll = () => {
        const anchor = getSourceScrollAnchor(view, documentId);

        if (anchor) {
          onScrollAnchorChangeRef.current?.(anchor, scrollSourceRef.current);
        }
      };

      view.dom.addEventListener("focusin", handleFocusIn);
      view.dom.addEventListener("focusout", handleSelectionChange);
      view.dom.addEventListener("keyup", handleSelectionChange);
      view.dom.addEventListener("mouseup", handleSelectionChange);
      view.scrollDOM.addEventListener("scroll", handleScroll, {
        passive: true
      });

      if (autoFocus) {
        view.focus();
      }

      return () => {
        view.dom.removeEventListener("focusin", handleFocusIn);
        view.dom.removeEventListener("focusout", handleSelectionChange);
        view.dom.removeEventListener("keyup", handleSelectionChange);
        view.dom.removeEventListener("mouseup", handleSelectionChange);
        view.scrollDOM.removeEventListener("scroll", handleScroll);
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

function emitSourceCursorAnchor(
  view: EditorView,
  documentId: string,
  callbackRef: RefObject<((anchor: EditorCursorAnchor) => void) | undefined>
): void {
  const anchor = getSourceCursorAnchor(view, documentId);

  if (anchor) {
    callbackRef.current?.(anchor);
  }
}

function createSourceEditorExtensions(
  onChange: (rawText: string) => void,
  onSelectionChange: (view: EditorView) => void
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
    search(),
    sourceSearchDecorations,
    markdownCommandKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }

      if (update.selectionSet) {
        onSelectionChange(update.view);
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
