import { runMarkdownCommand } from "./markdownCommands.js";
import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext
} from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import type { EditorKind } from "./editorTypes.js";
import type { SourceEditorHandle } from "./sourceEditorTypes.js";
import {
  applySourceCursorAnchor,
  applySourceScrollAnchor,
  getSourceCursorAnchor,
  getSourceScrollAnchor,
  getSourceSearchStatus,
  revealSourceSearchMatch,
  runSourceEditorCommand,
  setSourceSearchQuery
} from "./sourceEditorInterop.js";

export function createEditorHandle(
  getView: () => EditorView | null,
  documentId: string,
  kind: EditorKind,
  markProgrammaticScroll: () => void
): SourceEditorHandle {
  return {
    getStateToken: () => getView()?.state,
    runCommand: (command) => {
      const view = getView();
      return view ? runMarkdownCommand(view, command) : false;
    },
    findNext: (options) => runSourceEditorCommand(getView(), findNext, options),
    findPrevious: (options) =>
      runSourceEditorCommand(getView(), findPrevious, options),
    replaceAll: (options) =>
      runSourceEditorCommand(getView(), replaceAll, options),
    replaceNext: (options) =>
      runSourceEditorCommand(getView(), replaceNext, options),
    focus: () => getView()?.focus(),
    getCursorAnchor: () => getSourceCursorAnchor(getView(), documentId, kind),
    getScrollAnchor: () => getSourceScrollAnchor(getView(), documentId, kind),
    getSearchStatus: () => getSourceSearchStatus(getView()),
    applyCursorAnchor: (anchor) => applySourceCursorAnchor(getView(), anchor),
    applyScrollAnchor: (anchor) => {
      markProgrammaticScroll();
      applySourceScrollAnchor(getView(), anchor);
    },
    revealSearchMatch: (match) => revealSourceSearchMatch(getView(), match),
    setSearchQuery: (query) => setSourceSearchQuery(getView(), query)
  };
}
