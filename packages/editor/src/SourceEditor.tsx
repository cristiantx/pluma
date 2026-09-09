import { EditorView } from "@codemirror/view";
import { forwardRef, useCallback, type CSSProperties } from "react";
import { createSourceEditorExtensions } from "./sourceEditorExtensions.js";
import type {
  SourceEditorHandle,
  SourceEditorProps
} from "./sourceEditorTypes.js";
import { useCodeMirrorEditor } from "./useCodeMirrorEditor.js";

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor(props, ref) {
    const {
      "aria-label": ariaLabel = "Markdown source editor",
      sourceFontFamily = "mono",
      sourceFontSize = 14,
      sourceLineNumbers = true,
      sourceTabSize = 2,
      sourceWordWrap = true,
      spellCheck = true
    } = props;
    const createConfiguration = useCallback(
      () => [
        createSourceEditorExtensions({
          lineNumbers: sourceLineNumbers,
          tabSize: sourceTabSize,
          wordWrap: sourceWordWrap
        }),
        EditorView.contentAttributes.of({
          "aria-label": ariaLabel,
          spellcheck: String(spellCheck)
        })
      ],
      [ariaLabel, sourceLineNumbers, sourceTabSize, sourceWordWrap, spellCheck]
    );
    const { containerRef } = useCodeMirrorEditor(
      { ...props, kind: "source", createConfiguration },
      ref
    );
    return (
      <div
        className="pluma-source-editor"
        data-source-font-family={sourceFontFamily}
        ref={containerRef}
        style={
          {
            "--source-editor-font-size": `${sourceFontSize}px`
          } as CSSProperties
        }
      />
    );
  }
);
