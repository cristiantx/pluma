import type { ProjectInfo } from "@pluma/core";

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
