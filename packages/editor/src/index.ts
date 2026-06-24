import type { ProjectInfo } from "@pluma/core";

export { RichEditor } from "./RichEditor.js";
export { SourceEditor } from "./SourceEditor.js";
export {
  createEmptyEditorSearchQuery,
  findCurrentSearchIndex,
  findTextMatches,
  type TextSearchMatch,
  type TextSearchResult
} from "./editorSearch.js";
export {
  markdownCommandKeymap,
  runMarkdownCommand,
  type MarkdownCommandName
} from "./markdownCommands.js";
export type { RichEditorHandle, RichEditorProps } from "./richEditorTypes.js";
export type {
  RichSearchMatch,
  RichSearchRevealRequest
} from "./richEditorTypes.js";
export { plumaSourceEditorTheme } from "./sourceEditorTheme.js";
export type {
  SourceEditorHandle,
  SourceEditorProps,
  SourceSearchMatch
} from "./sourceEditorTypes.js";
export type {
  EditorCursorAnchor,
  EditorKind,
  EditorScrollAnchor,
  EditorScrollSyncSource,
  EditorSearchActionOptions,
  EditorSearchQuery,
  EditorSearchStatus
} from "./editorTypes.js";

export interface EditorFoundation {
  packageName: "@pluma/editor";
  richMarkdownPresets: readonly ["commonmark", "gfm"];
  supportsSourceMode: true;
  supportsRichMode: true;
}

export function createEditorFoundation(project: ProjectInfo): EditorFoundation {
  if (!project.localFirst) {
    throw new Error("Pluma editor foundation requires a local-first project.");
  }

  return {
    packageName: "@pluma/editor",
    richMarkdownPresets: ["commonmark", "gfm"],
    supportsSourceMode: true,
    supportsRichMode: true
  };
}
