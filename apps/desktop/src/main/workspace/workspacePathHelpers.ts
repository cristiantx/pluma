import path from "node:path";

import type { DocumentSession } from "@pluma/core";

import { isPathInsideDirectory } from "./desktopWorkspace";
import type { WorkspaceItemKind } from "./workspaceClipboard";

export function getWorkspaceTargetDirectory(
  targetPath: string,
  kind: WorkspaceItemKind
): string {
  return kind === "folder" ? targetPath : path.dirname(targetPath);
}

export function getDocumentsInWorkspacePath(
  documents: DocumentSession[],
  targetPath: string,
  kind: WorkspaceItemKind
): DocumentSession[] {
  return documents.filter((document) => {
    if (document.location.kind !== "desktop-path") {
      return false;
    }

    return kind === "folder"
      ? document.location.path === targetPath ||
          isPathInsideDirectory(targetPath, document.location.path)
      : document.location.path === targetPath;
  });
}
