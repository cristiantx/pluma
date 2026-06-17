import type { ProjectInfo } from "@pluma/core";

export { RichEditor } from "./RichEditor.js";
export { SourceEditor } from "./SourceEditor.js";
export {
  markdownCommandKeymap,
  runMarkdownCommand,
  type MarkdownCommandName
} from "./markdownCommands.js";
export type { RichEditorProps } from "./RichEditor.js";
export { plumaSourceEditorTheme } from "./sourceEditorTheme.js";
export type {
  SourceEditorHandle,
  SourceEditorProps,
  SourceSearchMatch
} from "./SourceEditor.js";

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
