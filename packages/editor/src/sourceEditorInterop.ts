import {
  getSearchQuery,
  SearchQuery,
  setSearchQuery
} from "@codemirror/search";
import { EditorView } from "@codemirror/view";

import { findCurrentSearchIndex, findTextMatches } from "./editorSearch.js";
import type {
  EditorCursorAnchor,
  EditorScrollAnchor,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus
} from "./editorTypes.js";
import {
  projectMarkdownVisibleText,
  sourceOffsetFromVisibleOffset,
  visibleOffsetFromSourceOffset
} from "./markdownVisibleTextProjection.js";
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
  const result = findTextMatches(view.state.doc.toString(), query);
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
  documentId: string
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
  const rect = scrollDOM.getBoundingClientRect();
  const position =
    view.posAtCoords({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }) ?? null;

  return {
    documentId,
    kind: "source",
    position,
    ratio: clampRatio(ratio)
  };
}

export function getSourceCursorAnchor(
  view: EditorView | null,
  documentId: string
): EditorCursorAnchor | null {
  if (!view) {
    return null;
  }

  const position = view.state.selection.main.head;
  const projection = projectMarkdownVisibleText(view.state.doc.toString());

  return {
    documentId,
    kind: "source",
    position,
    visibleOffset: visibleOffsetFromSourceOffset(projection, position)
  };
}

export function applySourceCursorAnchor(
  view: EditorView | null,
  anchor: EditorCursorAnchor
): void {
  if (!view) {
    return;
  }

  const docLength = view.state.doc.length;
  const projectedPosition =
    anchor.visibleOffset !== null
      ? sourceOffsetFromVisibleOffset(
          projectMarkdownVisibleText(view.state.doc.toString()),
          anchor.visibleOffset
        )
      : null;
  const position = Math.max(
    0,
    Math.min(
      anchor.kind === "source" && anchor.position !== null
        ? anchor.position
        : (projectedPosition ?? 0),
      docLength
    )
  );

  view.dispatch({
    effects: EditorView.scrollIntoView(position, { y: "center" }),
    selection: {
      anchor: position
    }
  });
  view.focus();
}

export function applySourceScrollAnchor(
  view: EditorView | null,
  anchor: EditorScrollAnchor
): void {
  if (!view) {
    return;
  }

  if (anchor.kind === "source" && anchor.position !== null) {
    view.dispatch({
      effects: EditorView.scrollIntoView(
        Math.max(0, Math.min(anchor.position, view.state.doc.length)),
        { y: "center" }
      )
    });
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
