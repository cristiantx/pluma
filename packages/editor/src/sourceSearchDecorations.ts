import { getSearchQuery } from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";

import { findTextMatches } from "./editorSearch.js";
import { editorSearchQueryFromCodeMirror } from "./sourceSearchQuery.js";

export const sourceSearchDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = createSourceSearchDecorations(view.state);
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.length > 0
      ) {
        this.decorations = createSourceSearchDecorations(update.state);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations
  }
);

function createSourceSearchDecorations(state: EditorState): DecorationSet {
  const query = editorSearchQueryFromCodeMirror(getSearchQuery(state));
  const result = findTextMatches(state.doc.toString(), query);
  const selectionFrom = state.selection.main.from;
  const selectionTo = state.selection.main.to;
  const decorations = result.matches.map((match) =>
    Decoration.mark({
      class:
        match.from === selectionFrom && match.to === selectionTo
          ? "pluma-source-search-match pluma-source-search-match-active"
          : "pluma-source-search-match"
    }).range(match.from, match.to)
  );

  return Decoration.set(decorations, true);
}
