import type { SearchQuery } from "@codemirror/search";

import type { EditorSearchQuery } from "./editorTypes.js";

export function editorSearchQueryFromCodeMirror(
  query: SearchQuery
): EditorSearchQuery {
  return {
    caseSensitive: query.caseSensitive,
    regexp: query.regexp,
    replace: query.replace,
    search: query.search,
    wholeWord: query.wholeWord
  };
}
