import { EditorView } from "@codemirror/view";

export function richEditorSelectionTheme(theme: "light" | "dark") {
  return EditorView.theme({
    ".cm-selectionLayer": { display: "none" },
    ".pluma-rich-selection-layer": {
      // Draftly's opaque table/code surfaces cover CodeMirror's background layer.
      // Blend above them so selection stays visible without painting over glyphs.
      zIndex: "1 !important",
      pointerEvents: "none",
      mixBlendMode: theme === "dark" ? "screen" : "multiply"
    },
    ".pluma-rich-selection-layer .cm-selectionBackground": {
      background: "var(--selection-bg) !important"
    }
  });
}
