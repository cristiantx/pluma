import {
  markDocumentSessionSaved,
  type DocumentSession,
  type FileMetadata
} from "@pluma/core";

export function markDocumentAfterSuccessfulWrite(
  document: DocumentSession,
  savedText: string,
  metadata: FileMetadata,
  originalText: string
): DocumentSession {
  if (document.rawText === originalText || document.rawText === savedText) {
    return markDocumentSessionSaved(
      {
        ...document,
        rawText: savedText
      },
      metadata
    );
  }

  return {
    ...document,
    lastSavedMetadata: metadata,
    lastSavedText: savedText,
    saveState: document.rawText === savedText ? "idle" : "dirty"
  };
}
