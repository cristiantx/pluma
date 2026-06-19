import type { EditorSearchQuery } from "./editorTypes.js";

export type TextSearchMatch = {
  from: number;
  replacement: string;
  to: number;
};

export type TextSearchResult = {
  matches: TextSearchMatch[];
  valid: boolean;
};

export function createEmptyEditorSearchQuery(): EditorSearchQuery {
  return {
    caseSensitive: false,
    regexp: false,
    replace: "",
    search: "",
    wholeWord: false
  };
}

export function findTextMatches(
  text: string,
  query: EditorSearchQuery
): TextSearchResult {
  if (!query.search) {
    return { matches: [], valid: true };
  }

  const expression = createSearchExpression(query);

  if (!expression) {
    return { matches: [], valid: false };
  }

  const matches: TextSearchMatch[] = [];

  for (const match of text.matchAll(expression)) {
    if (match.index === undefined) {
      continue;
    }

    const value = match[0];

    if (!value) {
      continue;
    }

    const from = match.index;
    const to = from + value.length;

    if (query.wholeWord && !isWholeWordMatch(text, from, to)) {
      continue;
    }

    matches.push({
      from,
      replacement: value.replace(
        expressionWithoutGlobal(expression),
        query.replace
      ),
      to
    });
  }

  return { matches, valid: true };
}

export function findCurrentSearchIndex(
  matches: readonly TextSearchMatch[],
  position: number
): number {
  const containingIndex = matches.findIndex(
    (match) => match.from <= position && match.to > position
  );

  if (containingIndex >= 0) {
    return containingIndex;
  }

  const nextIndex = matches.findIndex((match) => match.from >= position);

  return nextIndex >= 0 ? nextIndex : 0;
}

function createSearchExpression(query: EditorSearchQuery): RegExp | null {
  const flags = query.caseSensitive ? "g" : "gi";

  try {
    return new RegExp(
      query.regexp ? query.search : escapeRegExp(query.search),
      flags
    );
  } catch {
    return null;
  }
}

function expressionWithoutGlobal(expression: RegExp): RegExp {
  return new RegExp(expression.source, expression.flags.replace("g", ""));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWholeWordMatch(text: string, from: number, to: number): boolean {
  const before = from > 0 ? text[from - 1] : "";
  const after = to < text.length ? text[to] : "";

  return !isWordCharacter(before) && !isWordCharacter(after);
}

function isWordCharacter(value: string | undefined): boolean {
  return Boolean(value && /[\p{Letter}\p{Number}_]/u.test(value));
}
