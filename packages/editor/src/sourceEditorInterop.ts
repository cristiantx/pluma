import {
  getSearchQuery,
  SearchQuery,
  setSearchQuery
} from "@codemirror/search";
import { EditorView } from "@codemirror/view";

import { findCurrentSearchIndex } from "./editorSearch.js";
import type {
  EditorCursorAnchor,
  EditorKind,
  EditorScrollAnchor,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus
} from "./editorTypes.js";
import { EditorSelection } from "@codemirror/state";
import { getSourceSearchResults } from "./sourceSearchResults.js";
import type { SourceSearchMatch } from "./sourceEditorTypes.js";
import { editorSearchQueryFromCodeMirror } from "./sourceSearchQuery.js";

export function runSourceEditorCommand(
  view: EditorView | null,
  command: (view: EditorView) => boolean,
  options: EditorSearchActionOptions = {}
): void {
  if (!view) {
    return;
  }

  command(view);

  if (options.focusEditor !== false) {
    view.focus();
  }
}

export function getSourceSearchStatus(
  view: EditorView | null
): EditorSearchStatus {
  if (!view) {
    return { current: 0, total: 0, valid: true };
  }

  const query = editorSearchQueryFromCodeMirror(getSearchQuery(view.state));
  const result = getSourceSearchResults(view.state.doc, query);
  const current = result.matches.length
    ? findCurrentSearchIndex(result.matches, view.state.selection.main.head) + 1
    : 0;

  return {
    current,
    total: result.matches.length,
    valid: result.valid
  };
}

export function setSourceSearchQuery(
  view: EditorView | null,
  query: EditorSearchQuery
): void {
  if (!view) {
    return;
  }

  view.dispatch({
    effects: setSearchQuery.of(
      new SearchQuery({
        caseSensitive: query.caseSensitive,
        regexp: query.regexp,
        replace: query.replace,
        search: query.search,
        wholeWord: query.wholeWord
      })
    )
  });
}

export function getSourceScrollAnchor(
  view: EditorView | null,
  documentId: string,
  kind: EditorKind = "source"
): EditorScrollAnchor | null {
  if (!view) {
    return null;
  }

  const { scrollDOM } = view;
  const maxScrollTop = Math.max(
    0,
    scrollDOM.scrollHeight - scrollDOM.clientHeight
  );
  const ratio = maxScrollTop > 0 ? scrollDOM.scrollTop / maxScrollTop : 0;
  const rect = getElementRect(scrollDOM);
  const block =
    rect && typeof view.lineBlockAtHeight === "function"
      ? view.lineBlockAtHeight(Math.max(0, rect.top - view.documentTop))
      : null;
  const position = block?.from ?? (rect ? getPositionAtRect(view, rect) : null);

  return {
    documentId,
    kind,
    position,
    ratio: clampRatio(ratio),
    ...(block && rect
      ? { offset: block.top + view.documentTop - rect.top }
      : {})
  };
}

export function getSourceCursorAnchor(
  view: EditorView | null,
  documentId: string,
  kind: EditorKind = "source"
): EditorCursorAnchor | null {
  if (!view) {
    return null;
  }

  const position = view.state.selection.main.head;
  return {
    documentId,
    kind,
    position,
    visibleOffset: null,
    ranges: view.state.selection.ranges.map(({ anchor, head }) => ({
      anchor,
      head
    })),
    mainIndex: view.state.selection.mainIndex
  };
}

export function applySourceCursorAnchor(
  view: EditorView | null,
  anchor: EditorCursorAnchor
): void {
  if (!view) {
    return;
  }

  const clamp = (position: number) =>
    Math.max(0, Math.min(position, view.state.doc.length));
  const ranges = anchor.ranges?.length
    ? anchor.ranges
    : [{ anchor: anchor.position ?? 0, head: anchor.position ?? 0 }];
  const selection = EditorSelection.create(
    ranges.map((range) =>
      EditorSelection.range(clamp(range.anchor), clamp(range.head))
    ),
    Math.max(0, Math.min(anchor.mainIndex ?? 0, ranges.length - 1))
  );
  view.dispatch({
    selection,
    ...(anchor.ranges
      ? {}
      : {
          effects: EditorView.scrollIntoView(selection.main.head, {
            y: "center"
          })
        })
  });
  if (!anchor.ranges) view.focus();
}

export function applySourceScrollAnchor(
  view: EditorView | null,
  anchor: EditorScrollAnchor
): void {
  if (!view) {
    return;
  }

  if (anchor.position !== null) {
    const position = Math.max(
      0,
      Math.min(anchor.position, view.state.doc.length)
    );
    view.dispatch({
      effects: EditorView.scrollIntoView(position, { y: "start", yMargin: 0 })
    });
    if (
      typeof view.requestMeasure === "function" &&
      anchor.offset !== undefined
    ) {
      const doc = view.state.doc;
      let cancelled = false;
      const cancel = () => {
        cancelled = true;
        cleanup();
      };
      const cleanup = () => {
        for (const event of ["pointerdown", "keydown", "wheel"])
          view.dom.removeEventListener(event, cancel, true);
      };
      for (const event of ["pointerdown", "keydown", "wheel"])
        view.dom.addEventListener(event, cancel, { capture: true, once: true });
      view.requestMeasure({
        read: () =>
          !cancelled && view.state.doc === doc
            ? view.coordsAtPos(position)?.top
            : undefined,
        write: (top) => {
          cleanup();
          if (!cancelled && top !== undefined && view.state.doc === doc)
            view.scrollDOM.scrollTop +=
              top -
              view.scrollDOM.getBoundingClientRect().top -
              (anchor.offset ?? 0);
        }
      });
    }
    return;
  }
  const { scrollDOM } = view;
  scrollDOM.scrollTop =
    clampRatio(anchor.ratio) *
    Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight);
}

export function revealSourceSearchMatch(
  view: EditorView | null,
  match: SourceSearchMatch
): void {
  if (!view) {
    return;
  }

  if (
    !Number.isFinite(match.line) ||
    !Number.isFinite(match.matchStart) ||
    !Number.isFinite(match.matchEnd)
  ) {
    return;
  }

  const lineNumber = Math.max(1, Math.min(match.line, view.state.doc.lines));
  const line = view.state.doc.line(lineNumber);
  const matchStart = Math.max(0, Math.min(match.matchStart, match.matchEnd));
  const matchEnd = Math.max(match.matchStart, match.matchEnd);
  const from = Math.min(line.to, line.from + matchStart);
  const to = Math.min(line.to, line.from + Math.max(matchStart + 1, matchEnd));

  view.dispatch({
    effects: EditorView.scrollIntoView(from, { y: "center" }),
    selection: {
      anchor: from,
      head: to
    }
  });
  view.focus();
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function getElementRect(
  element: HTMLElement
): Pick<DOMRect, "left" | "top" | "width" | "height"> | null {
  const rect = element.getBoundingClientRect?.();

  if (
    !rect ||
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height)
  ) {
    return null;
  }

  return rect;
}

function getPositionAtRect(
  view: EditorView,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">
): number | null {
  try {
    return (
      view.posAtCoords({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }) ?? null
    );
  } catch {
    return null;
  }
}
