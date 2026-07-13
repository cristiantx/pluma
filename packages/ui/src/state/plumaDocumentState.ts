import { updateDocumentSessionText } from "@pluma/core";

import type { PlumaStoreState } from "./plumaStoreTypes.js";

type DocumentTextUpdate = Pick<PlumaStoreState, "document" | "tabs">;

export function updateDocumentTextState(
  state: PlumaStoreState,
  documentId: string,
  rawText: string
): DocumentTextUpdate | null {
  const currentDocument = state.document.documents.find(
    (document) => document.id === documentId
  );

  if (!currentDocument || currentDocument.rawText === rawText) {
    return null;
  }

  const nextDocument = updateDocumentSessionText(currentDocument, rawText);
  const nextDocuments = state.document.documents.map((document) =>
    document.id === documentId ? nextDocument : document
  );
  const nextActiveDocument =
    state.document.activeDocument?.id === documentId
      ? nextDocument
      : state.document.activeDocument;
  const nextIsDirty = nextDocument.saveState !== "idle";
  const shouldUpdateTab = state.tabs.tabs.some(
    (tab) =>
      tab.kind !== "settings" &&
      tab.id === documentId &&
      tab.isDirty !== nextIsDirty
  );

  return {
    document: {
      activeDocument: nextActiveDocument,
      documents: nextDocuments
    },
    tabs: {
      ...state.tabs,
      tabs: shouldUpdateTab
        ? state.tabs.tabs.map((tab) =>
            tab.kind !== "settings" && tab.id === documentId
              ? { ...tab, isDirty: nextIsDirty }
              : tab
          )
        : state.tabs.tabs
    }
  };
}
