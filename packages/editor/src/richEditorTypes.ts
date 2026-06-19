import type {
  EditorCursorAnchor,
  EditorScrollAnchor,
  EditorScrollSyncSource,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus
} from "./editorTypes.js";
import type {
  RichSearchMatch,
  RichSearchRevealRequest
} from "./richEditorSearch.js";

export type RichEditorProps = {
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
