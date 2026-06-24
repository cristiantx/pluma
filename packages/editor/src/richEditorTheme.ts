import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export const plumaRichEditorTheme: Extension = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--editor-bg)",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-ui)",
    fontSize: "16px",
    lineHeight: "1.6",
    "--color-border": "var(--border-default)",
    "--font-jetbrains-mono": "var(--font-editor)",
    "--font-sans": "var(--font-ui)"
  },
  ".cm-scroller": {
    fontFamily: "var(--font-ui)",
    overflow: "overlay"
  },
  ".cm-scroller::-webkit-scrollbar": {
    width: "12px",
    height: "12px"
  },
  ".cm-scroller::-webkit-scrollbar-track": {
    background: "transparent"
  },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    border: "2px solid transparent",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--text-muted) 34%, transparent)",
    backgroundClip: "content-box"
  },
  ".cm-scroller::-webkit-scrollbar-thumb:hover": {
    background: "color-mix(in srgb, var(--text-muted) 52%, transparent)",
    backgroundClip: "content-box"
  },
  ".cm-content": {
    flex: "0 0 auto",
    minHeight: "100%",
    width: "var(--rich-editor-content-width)",
    maxWidth: "var(--rich-editor-content-width)",
    padding: "64px 92px 88px",
    margin: "0 auto",
    caretColor: "var(--text-primary)"
  },
  ".cm-line": {
    padding: "0"
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--accent) 26%, transparent)"
  },
  ".cm-cursor": {
    borderLeftColor: "var(--text-primary)"
  },
  "&.cm-focused": {
    outline: "none"
  },
  "&.cm-draftly .cm-content": {
    fontFamily: "var(--font-ui)"
  },
  "&.cm-draftly .cm-content .cm-draftly-h1, &.cm-draftly .cm-content .cm-draftly-h2, &.cm-draftly .cm-content .cm-draftly-h3, &.cm-draftly .cm-content .cm-draftly-h4, &.cm-draftly .cm-content .cm-draftly-h5, &.cm-draftly .cm-content .cm-draftly-h6":
    {
      fontFamily: "var(--font-ui)"
    },
  "&.cm-draftly .cm-draftly-line-h1, &.cm-draftly .cm-draftly-line-h2, &.cm-draftly .cm-draftly-line-h3, &.cm-draftly .cm-draftly-line-h4, &.cm-draftly .cm-draftly-line-h5, &.cm-draftly .cm-draftly-line-h6":
    {
      fontFamily: "var(--font-ui)"
    },
  ".cm-draftly-code-header-right, .cm-draftly-code-copy-btn": {
    display: "none !important"
  },
  ".cm-draftly-mermaid-rendered": {
    width: "100%",
    minHeight: "180px",
    padding: "16px 0",
    overflow: "auto"
  },
  ".cm-draftly-mermaid-rendered svg": {
    width: "100%",
    minWidth: "520px",
    maxWidth: "100%",
    height: "auto"
  }
});
