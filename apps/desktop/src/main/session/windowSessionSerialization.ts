import type { DocumentSession } from "@pluma/core";

import type {
  DesktopShellSnapshot,
  EditorViewMode
} from "../../shared/shellState.js";
import type {
  PersistedDocumentReference,
  PersistedWindowSessionState
} from "../persistence/appPersistence.js";

export function serializeWindowSession(
  snapshot: DesktopShellSnapshot,
  editorMode: EditorViewMode,
  getReference: (document: DocumentSession) => PersistedDocumentReference | null
): PersistedWindowSessionState {
  const activeDocument = snapshot.documents.find(
    (document) => document.id === snapshot.activeDocumentId
  );
  const activeDocumentRef = activeDocument
    ? getReference(activeDocument)
    : null;

  return {
    activeDocumentRef,
    activeDocumentPath: getDocumentPath(
      snapshot.documents,
      snapshot.activeDocumentId
    ),
    documentRefs: snapshot.documents.flatMap((document) => {
      const documentRef = getReference(document);

      return documentRef ? [documentRef] : [];
    }),
    documentPaths: snapshot.documents.flatMap((document) =>
      document.location.kind === "desktop-path" ? [document.location.path] : []
    ),
    editorMode,
    paneSizes: snapshot.paneSizes,
    workspacePath: snapshot.workspacePath
  };
}

function getDocumentPath(
  documents: DocumentSession[],
  documentId: string | null
): string | null {
  const document = documents.find((candidate) => candidate.id === documentId);

  return document?.location.kind === "desktop-path"
    ? document.location.path
    : null;
}
