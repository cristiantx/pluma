import type {
  EditorCursorAnchor,
  EditorScrollAnchor,
  EditorScrollSyncSource,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus
} from "./editorTypes.js";

export type SourceEditorProps = {
  "aria-label"?: string;
  autoFocus?: boolean;
  documentId: string;
  onCursorAnchorChange?: (anchor: EditorCursorAnchor) => void;
  onFocus?: () => void;
  onReady?: () => void;
  onScrollAnchorChange?: (
    anchor: EditorScrollAnchor,
    source: EditorScrollSyncSource
  ) => void;
  onChange: (rawText: string) => void;
  rawText: string;
  searchRevealRequest?: (SourceSearchMatch & { requestId: number }) | null;
  sourceFontFamily?: "mono" | "system";
  sourceFontSize?: number;
  sourceLineNumbers?: boolean;
  sourceTabSize?: 2 | 4;
  sourceWordWrap?: boolean;
  spellCheck?: boolean;
};

export type SourceEditorHandle = {
  findNext: (options?: EditorSearchActionOptions) => void;
  findPrevious: (options?: EditorSearchActionOptions) => void;
  focus: () => void;
  getCursorAnchor: () => EditorCursorAnchor | null;
  getScrollAnchor: () => EditorScrollAnchor | null;
  getSearchStatus: () => EditorSearchStatus;
  applyCursorAnchor: (anchor: EditorCursorAnchor) => void;
  applyScrollAnchor: (anchor: EditorScrollAnchor) => void;
  replaceAll: (options?: EditorSearchActionOptions) => void;
  replaceNext: (options?: EditorSearchActionOptions) => void;
  revealSearchMatch: (match: SourceSearchMatch) => void;
  setSearchQuery: (query: EditorSearchQuery) => void;
};

export type SourceSearchMatch = {
  line: number;
  matchEnd: number;
  matchStart: number;
};
