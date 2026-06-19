import { Crepe } from "@milkdown/crepe";
import type { EditorView } from "@milkdown/prose/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import type { RefObject } from "react";

import { formatMarkdownText } from "@pluma/core";

import type {
  EditorCursorAnchor,
  EditorScrollSyncSource,
  EditorSearchQuery
} from "./editorTypes.js";
import { createEmptyEditorSearchQuery } from "./editorSearch.js";
import {
  applyRichScrollAnchor,
  getRichScrollAnchor,
  getRichScroller
} from "./richEditorScroll.js";
import {
  applyRichCursorAnchor,
  focusRichEditor,
  getRichCursorAnchor,
  getRichSearchStatus,
  replaceAllRichSearchMatches,
  replaceNextRichSearchMatch,
  revealRichSearchMatch,
  selectRichSearchMatch,
  updateRichSearchDecorations
} from "./richEditorSearch.js";
import type { RichEditorHandle, RichEditorProps } from "./richEditorTypes.js";

type MilkdownContextLookup = {
  get: <Value, Name extends string>(name: Name) => Value;
};

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(
    {
      "aria-label": ariaLabel = "Rich Markdown editor",
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
    const editorRef = useRef<Crepe | null>(null);
    const lastAppliedMarkdownRef = useRef(rawText);
    const markdownUpdateRevisionRef = useRef(0);
    const onCursorAnchorChangeRef = useRef(onCursorAnchorChange);
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onReadyRef = useRef(onReady);
    const onScrollAnchorChangeRef = useRef(onScrollAnchorChange);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const scrollSourceRef = useRef<EditorScrollSyncSource>("user");
    const searchQueryRef = useRef<EditorSearchQuery>(
      createEmptyEditorSearchQuery()
    );
    const viewRef = useRef<EditorView | null>(null);
    const [editorRevision, setEditorRevision] = useState(0);
    const [isReady, setIsReady] = useState(false);

    useImperativeHandle(ref, () => ({
      findNext: (options) =>
        selectRichSearchMatch(
          viewRef.current,
          searchQueryRef.current,
          "next",
          options
        ),
      findPrevious: (options) =>
        selectRichSearchMatch(
          viewRef.current,
          searchQueryRef.current,
          "previous",
          options
        ),
      focus: () => focusRichEditor(viewRef.current),
      getCursorAnchor: () => getRichCursorAnchor(viewRef.current, documentId),
      getScrollAnchor: () =>
        getRichScrollAnchor(
          viewRef.current,
          getRichScroller(rootRef.current),
          documentId
        ),
      getSearchStatus: () =>
        getRichSearchStatus(viewRef.current, searchQueryRef.current),
      applyCursorAnchor: (anchor) =>
        applyRichCursorAnchor(viewRef.current, anchor),
      applyScrollAnchor: (anchor) => {
        scrollSourceRef.current = "programmatic";
        applyRichScrollAnchor(
          viewRef.current,
          getRichScroller(rootRef.current),
          anchor
        );
        window.requestAnimationFrame(() => {
          scrollSourceRef.current = "user";
        });
      },
      replaceAll: (options) =>
        replaceAllRichSearchMatches(
          viewRef.current,
          searchQueryRef.current,
          options
        ),
      replaceNext: (options) =>
        replaceNextRichSearchMatch(
          viewRef.current,
          searchQueryRef.current,
          options
        ),
      revealSearchMatch: (match) =>
        revealRichSearchMatch(viewRef.current, match),
      setSearchQuery: (query) => {
        searchQueryRef.current = query;
        updateRichSearchDecorations(viewRef.current, query);
      }
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
      const root = rootRef.current;

      if (!root) {
        return;
      }

      let isDisposed = false;
      // Crepe registers Milkdown's CommonMark and GFM presets internally.
      const editor = new Crepe({
        defaultValue: rawText,
        root
      });

      editor.on((api) => {
        api.markdownUpdated((_, markdown) => {
          const updateRevision = markdownUpdateRevisionRef.current + 1;
          markdownUpdateRevisionRef.current = updateRevision;

          void formatMarkdownText(markdown).then((formatResult) => {
            if (
              isDisposed ||
              updateRevision !== markdownUpdateRevisionRef.current
            ) {
              return;
            }

            lastAppliedMarkdownRef.current = formatResult.markdown;
            onChangeRef.current(formatResult.markdown);
          });
        });
      });

      void editor.create().then(() => {
        if (isDisposed) {
          void editor.destroy();
          return;
        }

        editorRef.current = editor;
        viewRef.current = editor.editor.action((ctx: MilkdownContextLookup) =>
          ctx.get<EditorView, "editorView">("editorView")
        );
        updateRichSearchDecorations(viewRef.current, searchQueryRef.current);
        lastAppliedMarkdownRef.current = rawText;
        setIsReady(true);
        onReadyRef.current?.();

        if (autoFocus) {
          root.querySelector<HTMLElement>(".ProseMirror")?.focus();
        }
      });

      return () => {
        isDisposed = true;
        editorRef.current = null;
        viewRef.current = null;
        setIsReady(false);
        void editor.destroy();
      };
    }, [autoFocus, documentId, editorRevision]);

    useEffect(() => {
      const editor = editorRef.current;

      if (!editor || rawText === lastAppliedMarkdownRef.current) {
        return;
      }

      lastAppliedMarkdownRef.current = rawText;
      setEditorRevision((current) => current + 1);
    }, [rawText]);

    useEffect(() => {
      if (!searchRevealRequest) {
        return;
      }

      revealRichSearchMatch(viewRef.current, searchRevealRequest);
    }, [searchRevealRequest?.requestId, searchRevealRequest]);

    useEffect(() => {
      const root = rootRef.current;
      const scroller = getRichScroller(root);

      if (!root || !scroller) {
        return;
      }

      const handleFocusIn = () => {
        onFocusRef.current?.();
        emitRichCursorAnchor(
          viewRef.current,
          documentId,
          onCursorAnchorChangeRef
        );
      };
      const handleSelectionChange = () => {
        emitRichCursorAnchor(
          viewRef.current,
          documentId,
          onCursorAnchorChangeRef
        );
      };
      const handleDocumentSelectionChange = () => {
        if (!root.contains(root.ownerDocument.activeElement)) {
          return;
        }

        emitRichCursorAnchor(
          viewRef.current,
          documentId,
          onCursorAnchorChangeRef
        );
      };
      const handleScroll = () => {
        const anchor = getRichScrollAnchor(
          viewRef.current,
          scroller,
          documentId
        );

        if (anchor) {
          onScrollAnchorChangeRef.current?.(anchor, scrollSourceRef.current);
        }
      };

      root.addEventListener("focusin", handleFocusIn);
      root.addEventListener("focusout", handleSelectionChange);
      root.addEventListener("keyup", handleSelectionChange);
      root.addEventListener("mouseup", handleSelectionChange);
      root.ownerDocument.addEventListener(
        "selectionchange",
        handleDocumentSelectionChange
      );
      scroller.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        root.removeEventListener("focusin", handleFocusIn);
        root.removeEventListener("focusout", handleSelectionChange);
        root.removeEventListener("keyup", handleSelectionChange);
        root.removeEventListener("mouseup", handleSelectionChange);
        root.ownerDocument.removeEventListener(
          "selectionchange",
          handleDocumentSelectionChange
        );
        scroller.removeEventListener("scroll", handleScroll);
      };
    }, [documentId, isReady]);

    return (
      <div
        className="rich-editor"
        data-rich-editor-document-id={documentId}
        aria-label={ariaLabel}
        data-ready={isReady}
        spellCheck={spellCheck}
      >
        <div
          className="rich-editor-surface"
          ref={rootRef}
          spellCheck={spellCheck}
        />
      </div>
    );
  }
);

function emitRichCursorAnchor(
  view: EditorView | null,
  documentId: string,
  callbackRef: RefObject<((anchor: EditorCursorAnchor) => void) | undefined>
): void {
  const anchor = getRichCursorAnchor(view, documentId);

  if (anchor) {
    callbackRef.current?.(anchor);
  }
}
