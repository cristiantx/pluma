import { EditorView } from "@codemirror/view";
import { forwardRef, useCallback, useEffect, useRef } from "react";
import { createDraftlyPlugins, loadDraftlyPlugins } from "./draftlyPlugins.js";
import { connectRichEditorDOM } from "./richEditorDOM.js";
import { plumaRichEditorTheme } from "./richEditorTheme.js";
import { resolveRichEditorImageUrls } from "./richEditorImageUrls.js";
import type { RichEditorHandle, RichEditorProps } from "./richEditorTypes.js";
import { useCodeMirrorEditor } from "./useCodeMirrorEditor.js";

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(props, ref) {
    const {
      "aria-label": ariaLabel = "Rich Markdown editor",
      resolvedTheme = "light",
      spellCheck = true
    } = props;
    const latest = useRef(props);
    latest.current = props;
    const createConfiguration = useCallback(async () => {
      const [{ draftly, ThemeEnum }, modules] = await Promise.all([
        import("draftly/editor"),
        loadDraftlyPlugins()
      ]);
      return [
        draftly({
          baseStyles: true,
          defaultKeybindings: false,
          history: false,
          highlightActiveLine: false,
          indentWithTab: false,
          plugins: createDraftlyPlugins(modules),
          theme: resolvedTheme === "dark" ? ThemeEnum.DARK : ThemeEnum.LIGHT,
          onPluginError: (plugin, error) =>
            latest.current.onError?.(
              new Error(
                `${plugin}: ${error instanceof Error ? error.message : String(error)}`
              )
            )
        }),
        plumaRichEditorTheme,
        EditorView.contentAttributes.of({
          "aria-label": ariaLabel,
          spellcheck: String(spellCheck)
        })
      ];
    }, [ariaLabel, resolvedTheme, spellCheck]);
    const connectDOM = useCallback(
      (view: EditorView) =>
        connectRichEditorDOM(
          view,
          () => latest.current.imageBaseUrl,
          (url) => latest.current.onOpenLinkRequest?.(url)
        ),
      []
    );
    const { containerRef, viewRef, isReady, loadError } = useCodeMirrorEditor(
      { ...props, kind: "rich", createConfiguration, connectDOM },
      ref
    );
    useEffect(() => {
      if (viewRef.current)
        resolveRichEditorImageUrls(viewRef.current.dom, props.imageBaseUrl);
    }, [props.imageBaseUrl, viewRef]);
    return (
      <div
        className="rich-editor"
        data-ready={isReady}
        data-rich-editor-document-id={props.documentId}
      >
        {loadError ? (
          <p className="editor-load-error" role="alert">
            {loadError}
          </p>
        ) : null}
        <div className="rich-editor-surface" ref={containerRef} />
      </div>
    );
  }
);
