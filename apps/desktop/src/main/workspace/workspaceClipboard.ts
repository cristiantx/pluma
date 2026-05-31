export type WorkspaceItemKind = "file" | "folder";

export type WorkspaceClipboardEntry = {
  operation: "copy" | "cut";
  path: string;
  kind: WorkspaceItemKind;
};

let workspaceClipboard: WorkspaceClipboardEntry | null = null;

export function getWorkspaceClipboard(): WorkspaceClipboardEntry | null {
  return workspaceClipboard;
}

export function hasWorkspaceClipboard(): boolean {
  return workspaceClipboard !== null;
}

export function setWorkspaceClipboard(entry: WorkspaceClipboardEntry): void {
  workspaceClipboard = entry;
}

export function clearWorkspaceClipboard(): void {
  workspaceClipboard = null;
}
