export type EditorKind = "rich" | "source";

export type EditorScrollAnchor = {
  documentId: string;
  kind: EditorKind;
  position: number | null;
  ratio: number;
  offset?: number;
};

export type EditorCursorAnchor = {
  documentId: string;
  kind: EditorKind;
  position: number | null;
  visibleOffset: number | null;
  ranges?: { anchor: number; head: number }[];
  mainIndex?: number;
};

export type EditorSearchQuery = {
  caseSensitive: boolean;
  regexp: boolean;
  replace: string;
  search: string;
  wholeWord: boolean;
};

export type EditorSearchStatus = {
  current: number;
  total: number;
  valid: boolean;
};

export type EditorSearchActionOptions = {
  focusEditor?: boolean;
};

export type EditorScrollSyncSource = "programmatic" | "user";
