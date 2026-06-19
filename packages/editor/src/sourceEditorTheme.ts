import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const plumaSourceEditorTheme: Extension = [
  EditorView.theme({
    "&": {
      height: "100%",
      backgroundColor: "var(--editor-source-bg)",
      color: "var(--text-secondary)",
      fontFamily: "var(--font-editor)",
      fontSize: "14px",
      lineHeight: "1.65"
    },
    ".cm-scroller": {
      fontFamily: "var(--font-editor)",
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
      width: "min(var(--source-editor-content-width), calc(100% - 112px))",
      maxWidth: "var(--source-editor-content-width)",
      padding: "18px 24px 64px 0",
      caretColor: "var(--text-primary)"
    },
    ".cm-line": {
      padding: "0 0 0 8px"
    },
    ".cm-gutters": {
      backgroundColor: "var(--editor-source-bg)",
      borderRight: "0",
      color: "var(--text-muted)",
      paddingLeft:
        "max(24px, calc((100% - var(--source-editor-shell-width)) / 2))"
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "41px",
      padding: "0 13px 0 0",
      textAlign: "right"
    },
    ".cm-foldGutter .cm-gutterElement": {
      width: "18px",
      padding: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    ".pluma-fold-marker": {
      width: "16px",
      height: "16px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-muted)"
    },
    ".pluma-fold-marker svg": {
      width: "14px",
      height: "14px",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
    ".pluma-fold-marker:hover": {
      color: "var(--text-primary)"
    },
    ".cm-activeLine": {
      backgroundColor:
        "color-mix(in srgb, var(--active-control) 70%, transparent)"
    },
    ".cm-activeLineGutter": {
      backgroundColor:
        "color-mix(in srgb, var(--active-control) 70%, transparent)",
      color: "var(--text-primary)"
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent) 26%, transparent)"
    },
    ".cm-cursor": {
      borderLeftColor: "var(--text-primary)"
    },
    "&.cm-focused": {
      outline: "none"
    }
  }),
  syntaxHighlighting(
    HighlightStyle.define([
      {
        tag: [tags.heading, tags.strong],
        color: "var(--accent-code)",
        fontWeight: "650"
      },
      {
        tag: [tags.emphasis, tags.quote],
        color: "var(--operator)"
      },
      {
        tag: [tags.link, tags.url, tags.string],
        color: "var(--string)"
      },
      {
        tag: [tags.monospace, tags.contentSeparator],
        color: "var(--accent-code)"
      },
      {
        tag: tags.punctuation,
        color: "var(--text-muted)"
      }
    ])
  )
];
