import { Crepe } from "@milkdown/crepe";
import { useEffect, useRef, useState } from "react";

import { normalizeRichMarkdown } from "./normalizeRichMarkdown.js";

export type RichEditorProps = {
  "aria-label"?: string;
  autoFocus?: boolean;
  documentId: string;
  onChange: (rawText: string) => void;
  rawText: string;
};

export function RichEditor({
  "aria-label": ariaLabel = "Rich Markdown editor",
  autoFocus = false,
  documentId,
  onChange,
  rawText
}: RichEditorProps) {
  const editorRef = useRef<Crepe | null>(null);
  const lastAppliedMarkdownRef = useRef(rawText);
  const onChangeRef = useRef(onChange);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    let isDisposed = false;
    const editor = new Crepe({
      defaultValue: rawText,
      root
    });

    editor.on((api) => {
      api.markdownUpdated((_, markdown) => {
        const normalizedMarkdown = normalizeRichMarkdown(markdown);

        lastAppliedMarkdownRef.current = normalizedMarkdown;
        onChangeRef.current(normalizedMarkdown);
      });
    });

    void editor.create().then(() => {
      if (isDisposed) {
        void editor.destroy();
        return;
      }

      editorRef.current = editor;
      lastAppliedMarkdownRef.current = rawText;
      setIsReady(true);

      if (autoFocus) {
        root.querySelector<HTMLElement>(".ProseMirror")?.focus();
      }
    });

    return () => {
      isDisposed = true;
      editorRef.current = null;
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

  return (
    <div
      className="rich-editor"
      data-rich-editor-document-id={documentId}
      aria-label={ariaLabel}
      data-ready={isReady}
    >
      <div className="rich-editor-surface" ref={rootRef} />
    </div>
  );
}
