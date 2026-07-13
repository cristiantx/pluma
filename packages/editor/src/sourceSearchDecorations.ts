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
import type { TextSearchMatch } from "./editorSearch.js";
import type { EditorSearchQuery } from "./editorTypes.js";
import { editorSearchQueryFromCodeMirror } from "./sourceSearchQuery.js";

export const sourceSearchDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    matchCache: SourceSearchMatchCache;

    constructor(view: EditorView) {
      this.matchCache = updateSourceSearchMatchCache(
        null,
        editorSearchQueryFromCodeMirror(getSearchQuery(view.state)),
        true,
        () => view.state.doc.toString()
      );
      this.decorations = createSourceSearchDecorations(
        view.state,
        this.matchCache.matches
      );
    }

    update(update: ViewUpdate): void {
      const previousCache = this.matchCache;
      this.matchCache = updateSourceSearchMatchCache(
        previousCache,
        editorSearchQueryFromCodeMirror(getSearchQuery(update.state)),
        update.docChanged,
        () => update.state.doc.toString()
      );

      if (this.matchCache !== previousCache || update.selectionSet) {
        this.decorations = createSourceSearchDecorations(
          update.state,
          this.matchCache.matches
        );
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations
  }
);

export type SourceSearchMatchCache = {
  matches: readonly TextSearchMatch[];
  query: EditorSearchQuery;
};

export function updateSourceSearchMatchCache(
  cache: SourceSearchMatchCache | null,
  query: EditorSearchQuery,
  documentChanged: boolean,
  readText: () => string
): SourceSearchMatchCache {
  if (!query.search) {
    if (cache && areEditorSearchQueriesEqual(cache.query, query)) {
      return cache;
    }

    return { matches: [], query };
  }

  if (
    cache &&
    !documentChanged &&
    areEditorSearchQueriesEqual(cache.query, query)
  ) {
    return cache;
  }

  return {
    matches: findTextMatches(readText(), query).matches,
    query
  };
}

function areEditorSearchQueriesEqual(
  left: EditorSearchQuery,
  right: EditorSearchQuery
): boolean {
  return (
    left.caseSensitive === right.caseSensitive &&
    left.regexp === right.regexp &&
    left.replace === right.replace &&
    left.search === right.search &&
    left.wholeWord === right.wholeWord
  );
}

function createSourceSearchDecorations(
  state: EditorState,
  matches: readonly TextSearchMatch[]
): DecorationSet {
  const selectionFrom = state.selection.main.from;
  const selectionTo = state.selection.main.to;
  const decorations = matches.map((match) =>
    Decoration.mark({
      class:
        match.from === selectionFrom && match.to === selectionTo
          ? "pluma-source-search-match pluma-source-search-match-active"
          : "pluma-source-search-match"
    }).range(match.from, match.to)
  );

  return Decoration.set(decorations, true);
}
