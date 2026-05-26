import { projectInfo } from "@pluma/core";
import { createEditorFoundation } from "@pluma/editor";

export interface DesktopFoundation {
  appName: "Pluma";
  phase: 0;
  editor: ReturnType<typeof createEditorFoundation>;
}

export function createDesktopFoundation(): DesktopFoundation {
  return {
    appName: "Pluma",
    phase: 0,
    editor: createEditorFoundation(projectInfo)
  };
}
