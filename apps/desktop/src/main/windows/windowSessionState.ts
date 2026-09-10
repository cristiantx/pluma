import type { DocumentSession } from "@pluma/core";
import type { DesktopShellSnapshot } from "../../shared/shellState";

export class WindowSessionState {
  constructor(
    public value: DesktopShellSnapshot,
    private readonly onMenuStateChange: () => void
  ) {}
  update(update: Partial<DesktopShellSnapshot>): DesktopShellSnapshot {
    const hadActiveDocument = this.getActiveDocumentForActiveTab() !== null;
    const previousIndex = this.value.workspaceIndex ?? {
      generation: 0,
      revision: 0,
      status: "ready" as const,
      error: null
    };
    const changedWorkspace =
      update.workspacePath !== undefined &&
      update.workspacePath !== this.value.workspacePath;
    const changedEntries =
      update.workspaceEntries !== undefined &&
      update.workspaceEntries !== this.value.workspaceEntries;
    this.value = {
      ...this.value,
      ...update,
      workspaceIndex: {
        ...previousIndex,
        ...update.workspaceIndex,
        generation: previousIndex.generation + Number(changedWorkspace),
        revision: previousIndex.revision + Number(changedEntries),
        ...(changedWorkspace
          ? {
              status: update.workspacePath
                ? ("loading" as const)
                : ("ready" as const),
              error: null
            }
          : {})
      }
    };
    if (
      hadActiveDocument !== (this.getActiveDocumentForActiveTab() !== null) ||
      update.activeTabId !== undefined ||
      update.documents !== undefined
    )
      this.onMenuStateChange();
    return this.value;
  }
  getActiveDocument(): DocumentSession | null {
    return this.getDocumentById(this.value.activeDocumentId);
  }
  getActiveDocumentForActiveTab(): DocumentSession | null {
    return this.value.activeDocumentId &&
      this.value.activeTabId === this.value.activeDocumentId
      ? this.getActiveDocument()
      : null;
  }
  getDocumentById(documentId: string | null): DocumentSession | null {
    return (
      this.value.documents.find((document) => document.id === documentId) ??
      null
    );
  }
  getDocumentByDesktopPath(filePath: string): DocumentSession | null {
    return (
      this.value.documents.find(
        (document) =>
          document.location.kind === "desktop-path" &&
          document.location.path === filePath
      ) ?? null
    );
  }
  getDocumentPath(documentId: string | null): string | null {
    const document = this.getDocumentById(documentId);
    return document?.location.kind === "desktop-path"
      ? document.location.path
      : null;
  }
}
