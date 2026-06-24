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
    background: "var(--selection-bg) !important"
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    background: "var(--selection-bg) !important"
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
  "&.cm-draftly .cm-draftly-task-checkbox.checked input::after": {
    content: '""',
    position: "absolute",
    inset: "1px",
    backgroundColor: "currentColor",
    maskImage:
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M20 6 9 17l-5-5%27/%3E%3C/svg%3E")',
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "100% 100%",
    WebkitMaskImage:
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M20 6 9 17l-5-5%27/%3E%3C/svg%3E")',
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%"
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
