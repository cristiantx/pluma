import type { RichSearchRevealRequest } from "./richEditorTypes.js";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef
} from "react";
import { createEditorHandle } from "./editorHandle.js";
import { editorExtensions } from "./editorExtensions.js";
import { EditorSessionController } from "./editorSessionController.js";
import type { EditorKind, EditorScrollSyncSource } from "./editorTypes.js";
import type {
  SourceEditorHandle,
  SourceEditorProps
} from "./sourceEditorTypes.js";
import {
  getSourceCursorAnchor,
  getSourceScrollAnchor,
  revealSourceSearchMatch
} from "./sourceEditorInterop.js";

type Options = Pick<
  SourceEditorProps,
  | "documentId"
  | "rawText"
  | "autoFocus"
  | "onChange"
  | "onFocus"
  | "onReady"
  | "onCursorAnchorChange"
  | "onScrollAnchorChange"
  | "sessionController"
  | "baselineRevision"
> & {
  searchRevealRequest?:
    | SourceEditorProps["searchRevealRequest"]
    | RichSearchRevealRequest;
  kind: EditorKind;
  createConfiguration: () => Extension | Promise<Extension>;
  connectDOM?: (view: EditorView) => () => void;
  onError?: ((error: Error) => void) | undefined;
};

export function useCodeMirrorEditor(
  options: Options,
  ref: ForwardedRef<SourceEditorHandle>
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const localController = useRef(new EditorSessionController());
  const controller = options.sessionController ?? localController.current;
  const latest = useRef(options);
  latest.current = options;
  const configurationRef = useRef<Extension>([]);
  const cleanupDOM = useRef<(() => void) | null>(null);
  const scrollSource = useRef<EditorScrollSyncSource>("user");
  const frame = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { documentId, kind, createConfiguration } = options;
  const baselineRef = useRef(options.baselineRevision);

  useImperativeHandle(
    ref,
    () =>
      createEditorHandle(
        () => viewRef.current,
        documentId,
        kind,
        () => {
          scrollSource.current = "programmatic";
          if (frame.current !== null) cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => {
            frame.current = null;
            scrollSource.current = "user";
          });
        }
      ),
    [documentId, kind]
  );

  useEffect(() => {
    return () => {
      const view = viewRef.current;
      if (view) {
        const cursor = getSourceCursorAnchor(view, documentId, kind);
        if (cursor) latest.current.onCursorAnchorChange?.(cursor);
        controller.capture(documentId, view.state);
        cleanupDOM.current?.();
        cleanupDOM.current = null;
        viewRef.current = null;
        view.destroy();
      }
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      setIsReady(false);
    };
  }, [controller, documentId, kind]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void Promise.resolve()
      .then(createConfiguration)
      .then((configuration) => {
        if (cancelled || !containerRef.current) return;
        const extensions = [
          editorExtensions,
          configuration,
          EditorView.updateListener.of((update) => {
            controller.capture(documentId, update.state);
            if (update.docChanged)
              latest.current.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const anchor = getSourceCursorAnchor(
                update.view,
                documentId,
                kind
              );
              if (anchor) latest.current.onCursorAnchorChange?.(anchor);
            }
          })
        ];
        configurationRef.current = extensions;
        const current = viewRef.current;
        if (current) {
          controller.configure(documentId, current, extensions);
          current.requestMeasure();
          return;
        }
        const view = new EditorView({
          state: controller.acquire(
            documentId,
            latest.current.rawText,
            extensions,
            latest.current.baselineRevision
          ),
          parent: containerRef.current
        });
        viewRef.current = view;
        const focus = () => latest.current.onFocus?.();
        const scroll = () => {
          const anchor = getSourceScrollAnchor(view, documentId, kind);
          if (anchor)
            latest.current.onScrollAnchorChange?.(anchor, scrollSource.current);
        };
        view.dom.addEventListener("focusin", focus);
        view.scrollDOM.addEventListener("scroll", scroll, { passive: true });
        const disconnect = latest.current.connectDOM?.(view);
        cleanupDOM.current = () => {
          disconnect?.();
          view.dom.removeEventListener("focusin", focus);
          view.scrollDOM.removeEventListener("scroll", scroll);
        };
        setIsReady(true);
        if (latest.current.autoFocus) view.focus();
        view.requestMeasure();
        latest.current.onReady?.();
        if (latest.current.searchRevealRequest)
          revealSourceSearchMatch(view, latest.current.searchRevealRequest);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const failure =
          error instanceof Error ? error : new Error("Editor failed to load.");
        setLoadError(failure.message);
        latest.current.onError?.(failure);
      });
    return () => {
      cancelled = true;
    };
  }, [controller, createConfiguration, documentId, kind]);

  useEffect(() => {
    const view = viewRef.current;
    const baselineChanged = baselineRef.current !== options.baselineRevision;
    baselineRef.current = options.baselineRevision;
    if (
      view &&
      (baselineChanged || view.state.doc.toString() !== options.rawText)
    ) {
      controller.reload(
        documentId,
        view,
        options.rawText,
        configurationRef.current,
        options.baselineRevision
      );
      latest.current.onReady?.();
    }
  }, [controller, documentId, options.rawText, options.baselineRevision]);

  useEffect(() => {
    if (options.searchRevealRequest)
      revealSourceSearchMatch(viewRef.current, options.searchRevealRequest);
  }, [options.searchRevealRequest?.requestId]);

  return { containerRef, viewRef, isReady, loadError };
}
