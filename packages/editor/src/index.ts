import type { ProjectInfo } from "@pluma/core";

export { SourceEditor } from "./SourceEditor.js";
export {
  markdownCommandKeymap,
  runMarkdownCommand,
  type MarkdownCommandName
} from "./markdownCommands.js";
export { plumaSourceEditorTheme } from "./sourceEditorTheme.js";
export type { SourceEditorProps } from "./SourceEditor.js";

export interface EditorFoundation {
  packageName: "@pluma/editor";
  supportsSourceMode: true;
  supportsRichMode: true;
}

export function createEditorFoundation(project: ProjectInfo): EditorFoundation {
  if (!project.localFirst) {
    throw new Error("Pluma editor foundation requires a local-first project.");
  }

  return {
    packageName: "@pluma/editor",
    supportsSourceMode: true,
    supportsRichMode: true
  };
}
