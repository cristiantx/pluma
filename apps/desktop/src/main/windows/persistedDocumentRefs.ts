import type { DocumentSession } from "@pluma/core";

import type {
  PersistedDocumentReference,
  PersistedWindowSessionState
} from "../persistence/appPersistence";

export function getPersistedDocumentReference(
  document: DocumentSession
): PersistedDocumentReference | null {
  if (document.location.kind === "app-draft") {
    return {
      draftId: document.location.draftId,
      kind: "app-draft",
      name: document.location.name
    };
  }

  if (document.location.kind === "desktop-path") {
    return {
      kind: "desktop-path",
      path: document.location.path
    };
  }

  return null;
}

export function getActivePersistedDocument(
  documents: DocumentSession[],
  persistedState: PersistedWindowSessionState
): DocumentSession | undefined {
  const activeDocumentRef = persistedState.activeDocumentRef;

  if (activeDocumentRef) {
    const activeDocument = documents.find(
      (document) =>
        document.id === createPersistedDocumentSessionId(activeDocumentRef)
    );

    if (activeDocument) {
      return activeDocument;
    }
  }

  return (
    documents.find(
      (document) =>
        document.location.kind === "desktop-path" &&
        document.location.path === persistedState.activeDocumentPath
    ) ?? documents[0]
  );
}

function createPersistedDocumentSessionId(
  documentRef: PersistedDocumentReference
): string {
  return documentRef.kind === "app-draft"
    ? `draft:${documentRef.draftId}`
    : `desktop:${documentRef.path}`;
}
