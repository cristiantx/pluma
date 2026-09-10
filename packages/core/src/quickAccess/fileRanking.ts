import { deduplicateFileCandidates } from "./fileCandidates.js";
import {
  matchSearchText,
  mergeMatchRanges,
  prepareSearchText,
  type SearchText
} from "./fuzzyMatch.js";
import type {
  FileCandidate,
  FileSearchResult,
  MatchRange
} from "./searchTypes.js";

export interface PreparedFileCandidate {
  candidate: FileCandidate;
  name: SearchText;
  path: SearchText;
}

export interface PreparedFileQuery {
  tokens: string[][];
  pathFirst: boolean;
}

export interface RankedFileResult {
  result: FileSearchResult;
  rank: number[];
}

export function prepareFileCandidates(
  candidates: readonly FileCandidate[]
): PreparedFileCandidate[] {
  return deduplicateFileCandidates(candidates).map((candidate) => ({
    candidate,
    name: prepareSearchText(candidate.name),
    path: prepareSearchText(candidate.relativePath)
  }));
}

export function prepareFileQuery(query: string): PreparedFileQuery {
  return {
    tokens: query
      .trim()
      .split(/\s+/u)
      .filter(Boolean)
      .map((token) => prepareSearchText(token).characters),
    pathFirst: /[/\\]/u.test(query)
  };
}

/** Independently callable per candidate so workers can yield between bounded chunks. */
export function matchFileCandidate(
  entry: PreparedFileCandidate,
  query: PreparedFileQuery
): RankedFileResult | null {
  const nameMatches: MatchRange[] = [];
  const pathMatches: MatchRange[] = [];
  let tier = 0;
  let quality = 0;
  let gaps = 0;
  for (const token of query.tokens) {
    const name = matchSearchText(entry.name, token);
    const path = matchSearchText(entry.path, token);
    const usePath = query.pathFirst ? path !== null : name === null;
    const match = usePath ? path : name;
    if (!match) return null;
    tier = Math.max(
      tier,
      usePath === query.pathFirst ? match.tier : 4 + match.tier
    );
    quality += match.boundaryPenalty;
    gaps += match.gaps;
    (usePath ? pathMatches : nameMatches).push(...match.ranges);
  }
  if (query.tokens.length > 1 && tier < 4) {
    const phrase = query.tokens.flatMap((token, index) =>
      index ? [" ", ...token] : token
    );
    const whole = matchSearchText(
      query.pathFirst ? entry.path : entry.name,
      phrase
    );
    tier = whole?.tier ?? 3;
  }
  const { candidate } = entry;
  return {
    result: {
      candidate,
      nameMatches: mergeMatchRanges(nameMatches),
      pathMatches: mergeMatchRanges(pathMatches)
    },
    rank: [
      tier,
      quality,
      gaps,
      candidate.documentId === null ? 1 : 0,
      -(candidate.recency ?? -1)
    ]
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareFileResults(
  a: RankedFileResult,
  b: RankedFileResult
): number {
  for (let index = 0; index < a.rank.length; index += 1) {
    const difference = a.rank[index]! - b.rank[index]!;
    if (difference) return difference;
  }
  const left = a.result.candidate;
  const right = b.result.candidate;
  // Empty queries use alphabetical order; matched queries favor shorter paths.
  const empty = !a.result.nameMatches.length && !a.result.pathMatches.length;
  return (
    (!empty ? left.relativePath.length - right.relativePath.length : 0) ||
    compareText(left.relativePath, right.relativePath) ||
    compareText(left.path ?? "", right.path ?? "") ||
    compareText(left.documentId ?? "", right.documentId ?? "") ||
    compareText(left.id, right.id)
  );
}

export function collectFileResults(
  matches: readonly RankedFileResult[],
  limit = 50
): { results: FileSearchResult[]; total: number } {
  const cap = Number.isFinite(limit)
    ? Math.min(50, Math.max(0, Math.floor(limit)))
    : 50;
  return {
    results: [...matches]
      .sort(compareFileResults)
      .slice(0, cap)
      .map((match) => match.result),
    total: matches.length
  };
}

export function searchFiles(
  candidates: readonly FileCandidate[],
  query: string,
  limit = 50
): { results: FileSearchResult[]; total: number } {
  const prepared = prepareFileQuery(query);
  const matches = prepareFileCandidates(candidates)
    .map((entry) => matchFileCandidate(entry, prepared))
    .filter((match): match is RankedFileResult => match !== null);
  return collectFileResults(matches, limit);
}
