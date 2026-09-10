import type { DocumentSession } from "@pluma/core";

import type {
  PersistedDocumentReference,
  PersistedWindowSessionState
} from "../persistence/appPersistence.js";
import { mapWithConcurrency } from "../runtime/asyncConcurrency.js";

const restoredDocumentConcurrency = 2;

export type RestorePorts = {
  loadReference(
    reference: PersistedDocumentReference
  ): Promise<DocumentSession | null>;
  setDocumentMode(
    document: DocumentSession,
    mode: PersistedWindowSessionState["editorMode"]
  ): void;
  publishInitial(
    document: DocumentSession | null,
    persistedState: PersistedWindowSessionState
  ): void;
  publishDocuments(documents: DocumentSession[]): void;
  waitForRendererReady(): Promise<void>;
  refreshWorkspace(): Promise<void>;
};

export async function restoreWindowSession(
  persistedState: PersistedWindowSessionState,
  ports: RestorePorts
): Promise<void> {
  const documentRefs: PersistedDocumentReference[] =
    persistedState.documentRefs ??
    persistedState.documentPaths.map((documentPath) => ({
      kind: "desktop-path" as const,
      path: documentPath
    }));
  const prioritizedRefs = prioritizeActiveDocumentRef(
    documentRefs,
    persistedState
  );
  const attemptedKeys = new Set<string>();
  const loadedDocuments = new Map<string, DocumentSession>();
  let activeDocument: DocumentSession | null = null;

  for (const documentRef of prioritizedRefs) {
    const key = createDocumentModeKeyFromPersistedReference(documentRef);
    attemptedKeys.add(key);
    const document = await ports.loadReference(documentRef);

    if (document) {
      activeDocument = document;
      loadedDocuments.set(key, document);
      ports.setDocumentMode(
        document,
        documentRef.editorMode ?? persistedState.editorMode
      );
      break;
    }
  }

  ports.publishInitial(activeDocument, persistedState);
  await ports.waitForRendererReady();

  const remainingRefs = documentRefs.filter(
    (documentRef) =>
      !attemptedKeys.has(
        createDocumentModeKeyFromPersistedReference(documentRef)
      )
  );
  const restoreDocuments = mapWithConcurrency(
    remainingRefs,
    restoredDocumentConcurrency,
    async (documentRef) => {
      const document = await ports.loadReference(documentRef);

      if (!document) {
        return;
      }

      loadedDocuments.set(
        createDocumentModeKeyFromPersistedReference(documentRef),
        document
      );
      ports.setDocumentMode(
        document,
        documentRef.editorMode ?? persistedState.editorMode
      );
      ports.publishDocuments(
        getLoadedDocumentsInPersistedOrder(documentRefs, loadedDocuments)
      );
    }
  );
  const restoreWorkspace = ports.refreshWorkspace();

  await Promise.all([restoreDocuments, restoreWorkspace]);
}

function createDocumentModeKeyFromPersistedReference(
  documentRef: PersistedDocumentReference
): string {
  return documentRef.kind === "app-draft"
    ? `app-draft:${documentRef.draftId}`
    : `desktop-path:${documentRef.path}`;
}

function prioritizeActiveDocumentRef(
  documentRefs: PersistedDocumentReference[],
  persistedState: PersistedWindowSessionState
): PersistedDocumentReference[] {
  const activeKey = persistedState.activeDocumentRef
    ? createDocumentModeKeyFromPersistedReference(
        persistedState.activeDocumentRef
      )
    : persistedState.activeDocumentPath
      ? createDocumentModeKeyFromPersistedReference({
          kind: "desktop-path",
          path: persistedState.activeDocumentPath
        })
      : null;

  if (!activeKey) {
    return documentRefs;
  }

  const activeIndex = documentRefs.findIndex(
    (documentRef) =>
      createDocumentModeKeyFromPersistedReference(documentRef) === activeKey
  );

  if (activeIndex <= 0) {
    return documentRefs;
  }

  return [
    documentRefs[activeIndex]!,
    ...documentRefs.slice(0, activeIndex),
    ...documentRefs.slice(activeIndex + 1)
  ];
}

function getLoadedDocumentsInPersistedOrder(
  documentRefs: PersistedDocumentReference[],
  loadedDocuments: ReadonlyMap<string, DocumentSession>
): DocumentSession[] {
  const includedDocumentIds = new Set<string>();

  return documentRefs.flatMap((documentRef) => {
    const document = loadedDocuments.get(
      createDocumentModeKeyFromPersistedReference(documentRef)
    );

    if (!document || includedDocumentIds.has(document.id)) {
      return [];
    }

    includedDocumentIds.add(document.id);
    return [document];
  });
}
