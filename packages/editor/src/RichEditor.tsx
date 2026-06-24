import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
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
  keymap
} from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import type { RefObject } from "react";
import type * as DraftlyEditor from "draftly/editor";
import type * as DraftlyPlugins from "draftly/plugins";

import type {
  EditorCursorAnchor,
  EditorScrollSyncSource
} from "./editorTypes.js";
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
import { markdownCommandKeymap } from "./markdownCommands.js";
import { getRichEditorModifiedClickLinkUrl } from "./richEditorLinkClicks.js";
import { plumaRichEditorTheme } from "./richEditorTheme.js";
import { resolveRichEditorImageUrls } from "./richEditorImageUrls.js";
import type { RichEditorHandle, RichEditorProps } from "./richEditorTypes.js";
import { sourceSearchDecorations } from "./sourceSearchDecorations.js";

type DraftlyModule = typeof DraftlyEditor;
type DraftlyPluginsModule = typeof DraftlyPlugins;

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(
    {
      "aria-label": ariaLabel = "Rich Markdown editor",
      autoFocus = false,
      documentId,
      imageBaseUrl,
      onCursorAnchorChange,
      onFocus,
      onOpenLinkRequest,
      onReady,
      onScrollAnchorChange,
      onChange,
      rawText,
      resolvedTheme = "light",
      searchRevealRequest = null,
      spellCheck = true
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const onCursorAnchorChangeRef = useRef(onCursorAnchorChange);
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onOpenLinkRequestRef = useRef(onOpenLinkRequest);
    const onReadyRef = useRef(onReady);
    const onScrollAnchorChangeRef = useRef(onScrollAnchorChange);
    const imageBaseUrlRef = useRef(imageBaseUrl);
    const rawTextRef = useRef(rawText);
    const scrollSourceRef = useRef<EditorScrollSyncSource>("user");
    const viewRef = useRef<EditorView | null>(null);
    const [isReady, setIsReady] = useState(false);

    useImperativeHandle(ref, () => ({
      findNext: (options) =>
        runSourceEditorCommand(viewRef.current, findNext, options),
      findPrevious: (options) =>
        runSourceEditorCommand(viewRef.current, findPrevious, options),
      focus: () => viewRef.current?.focus(),
      getCursorAnchor: () =>
        getSourceCursorAnchor(viewRef.current, documentId, "rich"),
      getScrollAnchor: () =>
        getSourceScrollAnchor(viewRef.current, documentId, "rich"),
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
      imageBaseUrlRef.current = imageBaseUrl;
      rawTextRef.current = rawText;
    }, [imageBaseUrl, onChange]);

    useEffect(() => {
      rawTextRef.current = rawText;
    }, [rawText]);

    useEffect(() => {
      onCursorAnchorChangeRef.current = onCursorAnchorChange;
      onFocusRef.current = onFocus;
      onOpenLinkRequestRef.current = onOpenLinkRequest;
      onReadyRef.current = onReady;
      onScrollAnchorChangeRef.current = onScrollAnchorChange;
    }, [
      onCursorAnchorChange,
      onFocus,
      onOpenLinkRequest,
      onReady,
      onScrollAnchorChange
    ]);

    useEffect(() => {
      const parent = containerRef.current;

      if (!parent) {
        return;
      }

      let isDisposed = false;
      let initializedView: EditorView | null = null;
      let teardownListeners: (() => void) | null = null;
      let imageObserver: MutationObserver | null = null;

      void Promise.all([
        import("draftly/editor") as Promise<DraftlyModule>,
        import("draftly/plugins") as Promise<DraftlyPluginsModule>
      ]).then(([{ ThemeEnum, draftly }, draftlyPlugins]) => {
        if (isDisposed) {
          return;
        }

        const plugins = createDraftlyPlugins(draftlyPlugins);
        const draftlyTheme =
          resolvedTheme === "dark" ? ThemeEnum.DARK : ThemeEnum.LIGHT;
        const view = new EditorView({
          doc: rawTextRef.current,
          extensions: createRichEditorExtensions(
            [
              ...draftly({
                baseStyles: true,
                defaultKeybindings: false,
                history: false,
                highlightActiveLine: false,
                indentWithTab: false,
                plugins,
                theme: draftlyTheme
              })
            ],
            (nextText) => {
              onChangeRef.current(nextText);
            },
            (updatedView) => {
              emitRichCursorAnchor(
                updatedView,
                documentId,
                onCursorAnchorChangeRef
              );
            }
          ),
          parent
        });

        view.dom.setAttribute("aria-label", ariaLabel);
        setRichEditorSpellcheck(view, spellCheck);
        resolveRichEditorImageUrls(view.dom, imageBaseUrlRef.current);
        viewRef.current = view;
        initializedView = view;
        setIsReady(true);
        onReadyRef.current?.();

        const handleFocusIn = () => {
          onFocusRef.current?.();
          emitRichCursorAnchor(view, documentId, onCursorAnchorChangeRef);
        };
        const handleSelectionChange = () => {
          emitRichCursorAnchor(view, documentId, onCursorAnchorChangeRef);
        };
        const handleScroll = () => {
          const anchor = getSourceScrollAnchor(view, documentId, "rich");

          if (anchor) {
            onScrollAnchorChangeRef.current?.(anchor, scrollSourceRef.current);
          }
        };
        const handleClick = (event: MouseEvent) => {
          const linkUrl = getRichEditorModifiedClickLinkUrl(event);

          if (!linkUrl) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          onOpenLinkRequestRef.current?.(linkUrl);
        };

        view.dom.addEventListener("focusin", handleFocusIn);
        view.dom.addEventListener("focusout", handleSelectionChange);
        view.dom.addEventListener("keyup", handleSelectionChange);
        view.dom.addEventListener("mouseup", handleSelectionChange);
        view.dom.addEventListener("click", handleClick, { capture: true });
        view.scrollDOM.addEventListener("scroll", handleScroll, {
          passive: true
        });
        imageObserver = new MutationObserver(() => {
          resolveRichEditorImageUrls(view.dom, imageBaseUrlRef.current);
        });
        imageObserver.observe(view.dom, {
          childList: true,
          subtree: true
        });

        if (autoFocus) {
          view.focus();
        }

        viewRef.current = view;
        initializedView = view;

        teardownListeners = () => {
          view.dom.removeEventListener("focusin", handleFocusIn);
          view.dom.removeEventListener("focusout", handleSelectionChange);
          view.dom.removeEventListener("keyup", handleSelectionChange);
          view.dom.removeEventListener("mouseup", handleSelectionChange);
          view.dom.removeEventListener("click", handleClick, {
            capture: true
          });
          view.scrollDOM.removeEventListener("scroll", handleScroll);
        };
      });

      return () => {
        isDisposed = true;
        setIsReady(false);

        const view = initializedView ?? viewRef.current;

        if (view) {
          imageObserver?.disconnect();
          teardownListeners?.();
          view.destroy();
        }

        if (viewRef.current === view) {
          viewRef.current = null;
        }
      };
    }, [ariaLabel, autoFocus, documentId, resolvedTheme]);

    useEffect(() => {
      const view = viewRef.current;

      if (view) {
        resolveRichEditorImageUrls(view.dom, imageBaseUrl);
      }
    }, [imageBaseUrl]);

    useEffect(() => {
      setRichEditorSpellcheck(viewRef.current, spellCheck);
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

    return (
      <div
        className="rich-editor"
        data-ready={isReady}
        data-rich-editor-document-id={documentId}
      >
        <div
          aria-label={ariaLabel}
          className="rich-editor-surface"
          ref={containerRef}
          spellCheck={spellCheck}
        />
      </div>
    );
  }
);

function createRichEditorExtensions(
  draftlyExtensions: Extension[],
  onChange: (rawText: string) => void,
  onSelectionChange: (view: EditorView) => void
): Extension[] {
  return [
    history(),
    drawSelection(),
    dropCursor(),
    search(),
    sourceSearchDecorations,
    markdownCommandKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    draftlyExtensions,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }

      if (update.selectionSet) {
        onSelectionChange(update.view);
      }
    }),
    plumaRichEditorTheme
  ];
}

function createDraftlyPlugins({
  CodePlugin,
  EmojiPlugin,
  HRPlugin,
  HTMLPlugin,
  HeadingPlugin,
  ImagePlugin,
  InlinePlugin,
  LinkPlugin,
  ListPlugin,
  MathPlugin,
  MermaidPlugin,
  ParagraphPlugin,
  QuotePlugin,
  TablePlugin
}: DraftlyPluginsModule) {
  return [
    new ParagraphPlugin(),
    new HeadingPlugin(),
    new InlinePlugin(),
    new LinkPlugin(),
    new ListPlugin(),
    new TablePlugin(),
    new HTMLPlugin(),
    new ImagePlugin(),
    new MathPlugin(),
    new MermaidPlugin(),
    new CodePlugin(),
    new QuotePlugin(),
    new HRPlugin(),
    new EmojiPlugin()
  ];
}

function emitRichCursorAnchor(
  view: EditorView,
  documentId: string,
  callbackRef: RefObject<((anchor: EditorCursorAnchor) => void) | undefined>
): void {
  const anchor = getSourceCursorAnchor(view, documentId, "rich");

  if (anchor) {
    callbackRef.current?.(anchor);
  }
}

function setRichEditorSpellcheck(
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
