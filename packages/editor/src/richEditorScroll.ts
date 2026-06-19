import type { EditorView } from "@milkdown/prose/view";

import type { EditorScrollAnchor } from "./editorTypes.js";
import { selectProseMirrorRange } from "./richEditorSearch.js";

export function getRichScroller(root: HTMLElement | null): HTMLElement | null {
  return root?.closest<HTMLElement>(".rich-pane") ?? null;
}

export function getRichScrollAnchor(
  view: EditorView | null,
  scroller: HTMLElement | null,
  documentId: string
): EditorScrollAnchor | null {
  if (!view || !scroller) {
    return null;
  }

  const maxScrollTop = Math.max(
    0,
    scroller.scrollHeight - scroller.clientHeight
  );
  const ratio = maxScrollTop > 0 ? scroller.scrollTop / maxScrollTop : 0;
  const rect = scroller.getBoundingClientRect();
  const position =
    view.posAtCoords({
      left: rect.left + rect.width / 2,
      top: rect.top + rect.height / 2
    })?.pos ?? null;

  return {
    documentId,
    kind: "rich",
    position,
    ratio: clampRatio(ratio)
  };
}

export function applyRichScrollAnchor(
  view: EditorView | null,
  scroller: HTMLElement | null,
  anchor: EditorScrollAnchor
): void {
  if (!view || !scroller) {
    return;
  }

  if (anchor.kind === "rich" && anchor.position !== null) {
    const position = Math.max(
      0,
      Math.min(anchor.position, view.state.doc.content.size)
    );
    selectProseMirrorRange(view, position, position);
    return;
  }

  scroller.scrollTop =
    clampRatio(anchor.ratio) *
    Math.max(0, scroller.scrollHeight - scroller.clientHeight);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}
