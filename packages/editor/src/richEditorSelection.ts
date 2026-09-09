import { EditorSelection } from "@codemirror/state";
import {
  Direction,
  type EditorView,
  RectangleMarker,
  layer
} from "@codemirror/view";

const markerClass = "cm-selectionBackground";

// CodeMirror's line-based rectangles assume a row fills the content width.
// Draftly lays out table cells in that row, so measure their selected DOM text.
function tableMarkers(
  view: EditorView,
  row: Element,
  from: number,
  to: number
) {
  const markers: RectangleMarker[] = [];
  const document = view.dom.ownerDocument;
  const scroller = view.scrollDOM.getBoundingClientRect();
  const left =
    (view.textDirection === Direction.LTR
      ? scroller.left
      : scroller.right - view.scrollDOM.clientWidth * view.scaleX) -
    view.scrollDOM.scrollLeft * view.scaleX;
  const top = scroller.top - view.scrollDOM.scrollTop * view.scaleY;
  for (const cell of row.querySelectorAll(".cm-draftly-table-cell")) {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest('[contenteditable="false"]')) continue;
      const start = view.posAtDOM(node);
      const end = start + node.textContent!.length;
      if (end <= from || start >= to) continue;
      const range = document.createRange();
      range.setStart(node, Math.max(0, from - start));
      range.setEnd(node, Math.min(end, to) - start);
      for (const rect of range.getClientRects()) {
        if (rect.width && rect.height)
          markers.push(
            new RectangleMarker(
              markerClass,
              rect.left - left,
              rect.top - top,
              rect.width,
              rect.height
            )
          );
      }
    }
  }
  return markers;
}

export const richEditorSelection = layer({
  above: true,
  class: "pluma-rich-selection-layer",
  markers(view) {
    if (view.state.selection.ranges.every((range) => range.empty)) return [];
    const rows = Array.from(
      view.contentDOM.querySelectorAll(".cm-draftly-table-row"),
      (element) => ({
        element,
        line: view.state.doc.lineAt(view.posAtDOM(element))
      })
    );
    const markers: RectangleMarker[] = [];
    for (const range of view.state.selection.ranges) {
      if (range.empty) continue;
      let from = range.from;
      for (const row of rows) {
        if (row.line.to < from || row.line.from >= range.to) continue;
        if (from < row.line.from)
          markers.push(
            ...RectangleMarker.forRange(
              view,
              markerClass,
              EditorSelection.range(from, row.line.from)
            )
          );
        markers.push(
          ...tableMarkers(
            view,
            row.element,
            Math.max(from, row.line.from),
            Math.min(range.to, row.line.to)
          )
        );
        from = Math.min(range.to, row.line.to + 1);
      }
      if (from < range.to)
        markers.push(
          ...RectangleMarker.forRange(
            view,
            markerClass,
            EditorSelection.range(from, range.to)
          )
        );
    }
    return markers;
  },
  update(update) {
    return update.docChanged || update.selectionSet || update.viewportChanged;
  }
});
