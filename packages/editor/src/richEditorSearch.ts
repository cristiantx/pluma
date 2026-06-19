import { TextSelection } from "@milkdown/prose/state";
import {
  Decoration,
  DecorationSet,
  type EditorView
} from "@milkdown/prose/view";

import {
  findCurrentSearchIndex,
  findTextMatches,
  type TextSearchMatch
} from "./editorSearch.js";
import type {
  EditorCursorAnchor,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus
} from "./editorTypes.js";
import {
  getLineStarts,
  projectRichText,
  projectRichTextDocument,
  type RichTextProjection,
  textIndexFromProseMirrorPosition,
  toProseMirrorRange
} from "./richTextProjection.js";

export type RichSearchMatch = {
  line: number;
  matchEnd: number;
  matchStart: number;
};

export type RichSearchRevealRequest = RichSearchMatch & {
  requestId?: number;
};

type RichMatchRange = {
  proseFrom: number;
  proseTo: number;
  replacement: string;
  visibleFrom: number;
  visibleTo: number;
};

export function focusRichEditor(view: EditorView | null): void {
  view?.focus();
}

export function getRichCursorAnchor(
  view: EditorView | null,
  documentId: string
): EditorCursorAnchor | null {
  if (!view) {
    return null;
  }

  const projection = projectRichText(view);

  return {
    documentId,
    kind: "rich",
    position: view.state.selection.head,
    visibleOffset: textIndexFromProseMirrorPosition(
      projection,
      view.state.selection.head
    )
  };
}

export function applyRichCursorAnchor(
  view: EditorView | null,
  anchor: EditorCursorAnchor
): void {
  if (!view) {
    return;
  }

  const projection = projectRichText(view);
  const projectedPosition =
    anchor.visibleOffset !== null
      ? projection.positions[
          Math.max(
            0,
            Math.min(anchor.visibleOffset, projection.positions.length - 1)
          )
        ]
      : null;
  const position = Math.max(
    0,
    Math.min(
      anchor.kind === "rich" && anchor.position !== null
        ? anchor.position
        : (projectedPosition ?? 0),
      view.state.doc.content.size
    )
  );

  selectProseMirrorRange(view, position, position);
}

export function getRichSearchStatus(
  view: EditorView | null,
  query: EditorSearchQuery
): EditorSearchStatus {
  if (!view) {
    return { current: 0, total: 0, valid: true };
  }

  const projection = projectRichText(view);
  const result = findTextMatches(projection.text, query);
  const visibleMatches = result.matches
    .map((match) => toRichMatchRange(projection, match))
    .filter((match) => match !== null)
    .map((match) => ({
      from: match.visibleFrom,
      replacement: match.replacement,
      to: match.visibleTo
    }));
  const current = visibleMatches.length
    ? findCurrentSearchIndex(
        visibleMatches,
        textIndexFromProseMirrorPosition(projection, view.state.selection.from)
      ) + 1
    : 0;

  return {
    current,
    total: visibleMatches.length,
    valid: result.valid
  };
}

export function updateRichSearchDecorations(
  view: EditorView | null,
  query: EditorSearchQuery
): void {
  if (!view) {
    return;
  }

  view.setProps({
    decorations: (state) => {
      const projection = projectRichTextDocument(state.doc);
      const matches = getRichMatchRanges(projection, query);

      if (!matches.length) {
        return DecorationSet.empty;
      }

      const selectionFrom = state.selection.from;
      const selectionTo = state.selection.to;

      return DecorationSet.create(
        state.doc,
        matches.map((match) =>
          Decoration.inline(match.proseFrom, match.proseTo, {
            class:
              match.proseFrom === selectionFrom && match.proseTo === selectionTo
                ? "pluma-rich-search-match pluma-rich-search-match-active"
                : "pluma-rich-search-match"
          })
        )
      );
    }
  });
}

export function selectRichSearchMatch(
  view: EditorView | null,
  query: EditorSearchQuery,
  direction: "next" | "previous",
  options: EditorSearchActionOptions = {}
): void {
  const match = getNavigatedRichSearchMatch(view, query, direction);

  if (!view || !match) {
    return;
  }

  selectProseMirrorRange(view, match.proseFrom, match.proseTo, options);
}

export function replaceNextRichSearchMatch(
  view: EditorView | null,
  query: EditorSearchQuery,
  options: EditorSearchActionOptions = {}
): void {
  if (!view) {
    return;
  }

  const match =
    getSelectedRichSearchMatch(view, query) ??
    getNavigatedRichSearchMatch(view, query, "next");

  if (!match) {
    return;
  }

  view.dispatch(
    view.state.tr
      .insertText(match.replacement, match.proseFrom, match.proseTo)
      .scrollIntoView()
  );

  if (options.focusEditor !== false) {
    view.focus();
  }
}

export function replaceAllRichSearchMatches(
  view: EditorView | null,
  query: EditorSearchQuery,
  options: EditorSearchActionOptions = {}
): void {
  if (!view) {
    return;
  }

  const projection = projectRichText(view);
  const matches = getRichMatchRanges(projection, query).reverse();

  if (!matches.length) {
    return;
  }

  let transaction = view.state.tr;

  for (const match of matches) {
    transaction = transaction.insertText(
      match.replacement,
      match.proseFrom,
      match.proseTo
    );
  }

  view.dispatch(transaction.scrollIntoView());

  if (options.focusEditor !== false) {
    view.focus();
  }
}

export function revealRichSearchMatch(
  view: EditorView | null,
  match: RichSearchMatch
): void {
  if (!view) {
    return;
  }

  const projection = projectRichText(view);
  const lineStarts = getLineStarts(projection.text);
  const lineStart = lineStarts[Math.max(0, match.line - 1)] ?? 0;
  const fromIndex = lineStart + Math.max(0, match.matchStart);
  const toIndex = lineStart + Math.max(match.matchStart + 1, match.matchEnd);
  const from = projection.positions[fromIndex];
  const toPosition = projection.positions[toIndex - 1];

  if (
    from === null ||
    from === undefined ||
    toPosition === null ||
    toPosition === undefined
  ) {
    return;
  }

  selectProseMirrorRange(view, from, toPosition + 1);
}

export function selectProseMirrorRange(
  view: EditorView,
  from: number,
  to: number,
  options: EditorSearchActionOptions = {}
): void {
  view.dispatch(
    view.state.tr
      .setSelection(
        TextSelection.create(view.state.doc, from, Math.max(from, to))
      )
      .scrollIntoView()
  );
  revealProseMirrorPosition(view, from);

  if (options.focusEditor !== false) {
    view.focus();
  }
}

function getSelectedRichSearchMatch(
  view: EditorView,
  query: EditorSearchQuery
): RichMatchRange | null {
  const projection = projectRichText(view);
  const result = findTextMatches(projection.text, query);
  const { from, to } = view.state.selection;

  for (const match of result.matches) {
    const range = toProseMirrorRange(projection, match);

    if (range && range.from === from && range.to === to) {
      return {
        proseFrom: range.from,
        proseTo: range.to,
        replacement: match.replacement,
        visibleFrom: match.from,
        visibleTo: match.to
      };
    }
  }

  return null;
}

function getNavigatedRichSearchMatch(
  view: EditorView | null,
  query: EditorSearchQuery,
  direction: "next" | "previous"
): RichMatchRange | null {
  if (!view) {
    return null;
  }

  const projection = projectRichText(view);
  const matches = getRichMatchRanges(projection, query);

  if (!matches.length) {
    return null;
  }

  if (direction === "previous") {
    const currentTextIndex = textIndexFromProseMirrorPosition(
      projection,
      view.state.selection.from
    );

    return (
      [...matches]
        .reverse()
        .find((match) => match.visibleFrom < currentTextIndex) ??
      matches[matches.length - 1] ??
      null
    );
  }

  const currentTextIndex = textIndexFromProseMirrorPosition(
    projection,
    view.state.selection.to
  );

  return (
    matches.find((match) => match.visibleFrom > currentTextIndex) ??
    matches[0] ??
    null
  );
}

function toRichMatchRange(
  projection: RichTextProjection,
  match: TextSearchMatch
): RichMatchRange | null {
  const range = toProseMirrorRange(projection, match);

  if (!range) {
    return null;
  }

  return {
    proseFrom: range.from,
    proseTo: range.to,
    replacement: match.replacement,
    visibleFrom: match.from,
    visibleTo: match.to
  };
}

function getRichMatchRanges(
  projection: RichTextProjection,
  query: EditorSearchQuery
): RichMatchRange[] {
  return findTextMatches(projection.text, query)
    .matches.map((match) => toRichMatchRange(projection, match))
    .filter((match) => match !== null);
}

function revealProseMirrorPosition(view: EditorView, position: number): void {
  window.requestAnimationFrame(() => {
    const { node } = view.domAtPos(position);
    const element =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;

    element?.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  });
}
