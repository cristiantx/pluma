import type { FileLocation } from "./index.js";
import type { FileMetadata } from "./fileSystemAdapter.js";

export type DocumentCapability = "rich-safe" | "source-only" | "unknown";
export type DocumentMode = "rich" | "source";
export type DocumentSaveState =
  | "conflict"
  | "dirty"
  | "error"
  | "external-change"
  | "idle"
  | "saving";

export type DocumentSession = {
  capability: DocumentCapability;
  id: string;
  lastSavedMetadata: FileMetadata | null;
  lastSavedText: string;
  location: FileLocation;
  mode: DocumentMode;
  rawText: string;
  saveState: DocumentSaveState;
};

export type CreateDocumentSessionInput = {
  capability?: DocumentCapability;
  location: FileLocation;
  metadata: FileMetadata | null;
  mode?: DocumentMode;
  rawText: string;
};

export function createDocumentSession(
  input: CreateDocumentSessionInput
): DocumentSession {
  return {
    capability: input.capability ?? "unknown",
    id: getDocumentSessionId(input.location),
    lastSavedMetadata: input.metadata,
    lastSavedText: input.rawText,
    location: input.location,
    mode: input.mode ?? "source",
    rawText: input.rawText,
    saveState: "idle"
  };
}

export function getDocumentSessionId(location: FileLocation): string {
  if (location.kind === "desktop-path") {
    return `desktop:${location.path}`;
  }

  return `browser:${location.handleKey}`;
}

export function updateDocumentSessionText(
  session: DocumentSession,
  rawText: string
): DocumentSession {
  return {
    ...session,
    rawText,
    saveState: rawText === session.lastSavedText ? "idle" : "dirty"
  };
}

export function markDocumentSessionSaving(
  session: DocumentSession
): DocumentSession {
  return {
    ...session,
    saveState: "saving"
  };
}

export function markDocumentSessionSaved(
  session: DocumentSession,
  metadata: FileMetadata
): DocumentSession {
  return {
    ...session,
    lastSavedMetadata: metadata,
    lastSavedText: session.rawText,
    saveState: "idle"
  };
}

export function markDocumentSessionConflict(
  session: DocumentSession
): DocumentSession {
  return {
    ...session,
    saveState: "conflict"
  };
}

export function markDocumentSessionSaveError(
  session: DocumentSession
): DocumentSession {
  return {
    ...session,
    saveState: "error"
  };
}

export function markDocumentSessionExternalChange(
  session: DocumentSession
): DocumentSession {
  return {
    ...session,
    saveState:
      session.rawText === session.lastSavedText ? "external-change" : "conflict"
  };
}

export function shouldProtectDocumentSessionClose(
  session: DocumentSession
): boolean {
  return (
    session.saveState === "conflict" ||
    session.saveState === "dirty" ||
    session.saveState === "error" ||
    session.saveState === "saving"
  );
}
