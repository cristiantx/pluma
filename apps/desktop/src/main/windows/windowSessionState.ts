import type { DocumentSession } from "@pluma/core";
import type { DesktopShellSnapshot } from "../../shared/shellState";

export class WindowSessionState {
  constructor(
    public value: DesktopShellSnapshot,
    private readonly onMenuStateChange: () => void
  ) {}
  update(update: Partial<DesktopShellSnapshot>): DesktopShellSnapshot {
    const hadActiveDocument = this.getActiveDocumentForActiveTab() !== null;
    this.value = { ...this.value, ...update };
    if (hadActiveDocument !== (this.getActiveDocumentForActiveTab() !== null))
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
