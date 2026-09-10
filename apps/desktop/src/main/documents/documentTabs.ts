import { type DocumentSession } from "@pluma/core";
import type { DesktopShellSnapshot } from "../../shared/shellState";
export type DocumentTabsDependencies = {
  getShellData(): DesktopShellSnapshot;
  updateShellData(update: Partial<DesktopShellSnapshot>): void;
  syncEditorModeForActiveDocument(): void;
  updateActiveFileWatcher(): void;
  getDocumentById(id: string): DocumentSession | null;
  deleteDraftSoon(document: DocumentSession): void;
  clearAutosave(id: string): void;
};
export function createDocumentTabs(dependencies: DocumentTabsDependencies) {
  const replacementDocumentIds = new Map<string, string>();
  function mergeDocumentSession(nextSession: DocumentSession): void {
    const remainingDocuments = dependencies
      .getShellData()
      .documents.filter((document) => document.id !== nextSession.id);

    dependencies.updateShellData({
      activeDocumentId: nextSession.id,
      activeTabId: nextSession.id,
      documents: [nextSession, ...remainingDocuments]
    });
    dependencies.syncEditorModeForActiveDocument();
    dependencies.updateActiveFileWatcher();
  }

  function replaceDocumentSession(
    documentId: string,
    nextSession: DocumentSession
  ): void {
    replacementDocumentIds.set(documentId, nextSession.id);
    dependencies.updateShellData({
      activeDocumentId:
        dependencies.getShellData().activeDocumentId === documentId
          ? nextSession.id
          : dependencies.getShellData().activeDocumentId,
      activeTabId:
        dependencies.getShellData().activeTabId === documentId
          ? nextSession.id
          : dependencies.getShellData().activeTabId,
      documents: dependencies
        .getShellData()
        .documents.map((document) =>
          document.id === documentId ? nextSession : document
        )
    });
    dependencies.syncEditorModeForActiveDocument();
    dependencies.updateActiveFileWatcher();
  }

  function closeDocumentSession(documentId: string): void {
    const closingDocument = dependencies.getDocumentById(documentId);

    if (closingDocument?.location.kind === "app-draft") {
      dependencies.deleteDraftSoon(closingDocument);
    }

    dependencies.clearAutosave(documentId);
    const nextDocuments = dependencies
      .getShellData()
      .documents.filter((document) => document.id !== documentId);
    const activeDocumentId =
      dependencies.getShellData().activeDocumentId === documentId
        ? (nextDocuments[0]?.id ?? null)
        : dependencies.getShellData().activeDocumentId;

    dependencies.updateShellData({
      activeDocumentId,
      activeTabId:
        dependencies.getShellData().activeTabId === documentId
          ? activeDocumentId
          : dependencies.getShellData().activeTabId,
      documents: nextDocuments,
      status:
        nextDocuments.length === 0
          ? "All documents closed."
          : "Closed document tab."
    });
    dependencies.syncEditorModeForActiveDocument();
    dependencies.updateActiveFileWatcher();
  }

  function closeDocumentSessions(documentIds: string[], status: string): void {
    closeDocumentSessionsWithOptions(documentIds, status);
  }

  function closeDocumentSessionsWithOptions(
    documentIds: string[],
    status: string,
    options: { clearSettingsTab?: boolean } = {}
  ): void {
    const documentIdSet = new Set(documentIds);

    for (const documentId of documentIdSet) {
      const closingDocument = dependencies.getDocumentById(documentId);

      if (closingDocument?.location.kind === "app-draft") {
        dependencies.deleteDraftSoon(closingDocument);
      }

      dependencies.clearAutosave(documentId);
    }

    const nextDocuments = dependencies
      .getShellData()
      .documents.filter((document) => !documentIdSet.has(document.id));
    const activeDocumentId = documentIdSet.has(
      dependencies.getShellData().activeDocumentId ?? ""
    )
      ? (nextDocuments[0]?.id ?? null)
      : dependencies.getShellData().activeDocumentId;

    dependencies.updateShellData({
      activeDocumentId,
      activeTabId:
        options.clearSettingsTab &&
        dependencies.getShellData().activeTabId === "settings"
          ? activeDocumentId
          : documentIdSet.has(dependencies.getShellData().activeTabId ?? "")
            ? activeDocumentId
            : dependencies.getShellData().activeTabId,
      documents: nextDocuments,
      status
    });
    dependencies.syncEditorModeForActiveDocument();
    dependencies.updateActiveFileWatcher();
  }

  function getCurrentDocumentIdForClose(document: DocumentSession): string {
    return replacementDocumentIds.get(document.id) ?? document.id;
  }
  return {
    mergeDocumentSession,
    replaceDocumentSession,
    closeDocumentSession,
    closeDocumentSessions,
    closeDocumentSessionsWithOptions,
    getCurrentDocumentIdForClose
  };
}
