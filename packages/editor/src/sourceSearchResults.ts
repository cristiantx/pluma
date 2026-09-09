import type { Text } from "@codemirror/state";
import { findTextMatches, type TextSearchResult } from "./editorSearch.js";
import type { EditorSearchQuery } from "./editorTypes.js";

const results = new WeakMap<Text, { key: string; result: TextSearchResult }>();

/** Selection movement only changes the current match, not the document's matches. */
export function getSourceSearchResults(
  document: Text,
  query: EditorSearchQuery
): TextSearchResult {
  if (!query.search) return { matches: [], valid: true };
  const key = JSON.stringify(query);
  const cached = results.get(document);
  if (cached?.key === key) return cached.result;
  const result = findTextMatches(document.toString(), query);
  results.set(document, { key, result });
  return result;
}
