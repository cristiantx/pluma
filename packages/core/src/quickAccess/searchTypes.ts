export interface FileCandidate {
  id: string;
  name: string;
  path: string | null;
  relativePath: string;
  documentId: string | null;
  recency: number | null;
}

/** UTF-16 offsets into the original display string, aligned to graphemes. */
export interface MatchRange {
  start: number;
  end: number;
}

export interface FileSearchResult {
  candidate: FileCandidate;
  nameMatches: MatchRange[];
  pathMatches: MatchRange[];
}
