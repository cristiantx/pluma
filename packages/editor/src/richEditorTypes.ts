import type {
  EditorCursorAnchor,
  EditorScrollAnchor,
  EditorScrollSyncSource,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus
} from "./editorTypes.js";

export type RichSearchMatch = {
  line: number;
  matchEnd: number;
  matchStart: number;
};

export type RichSearchRevealRequest = RichSearchMatch & {
  requestId?: number;
};

export type RichEditorProps = {
  "aria-label"?: string;
  autoFocus?: boolean;
  documentId: string;
  imageBaseUrl?: string | undefined;
  resolvedTheme?: "dark" | "light";
  onCursorAnchorChange?: (anchor: EditorCursorAnchor) => void;
  onFocus?: () => void;
  onOpenLinkRequest?: (url: string) => void;
  onReady?: () => void;
  onScrollAnchorChange?: (
    anchor: EditorScrollAnchor,
    source: EditorScrollSyncSource
  ) => void;
  onChange: (rawText: string) => void;
  rawText: string;
  searchRevealRequest?: RichSearchRevealRequest | null;
  spellCheck?: boolean;
};

export type RichEditorHandle = {
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
  revealSearchMatch: (match: RichSearchMatch) => void;
  setSearchQuery: (query: EditorSearchQuery) => void;
};
