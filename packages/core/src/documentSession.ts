import type { FileLocation } from "./index.js";
import type { FileMetadata } from "./fileSystemAdapter.js";
import { detectLineEnding, type LineEnding } from "./lineEndings.js";

export type DocumentModeConstraint = "none" | "source-only";
export type DocumentMode = "rich" | "source";
export type DocumentSaveState =
  | "conflict"
  | "dirty"
  | "error"
  | "external-change"
  | "idle"
  | "saving";

export type DocumentSession = {
  id: string;
  lastSavedMetadata: FileMetadata | null;
  lastSavedText: string;
  lineEnding: LineEnding;
  location: FileLocation;
  mode: DocumentMode;
  modeConstraint: DocumentModeConstraint;
  rawText: string;
  saveState: DocumentSaveState;
};

export type CreateDocumentSessionInput = {
  lineEnding?: LineEnding;
  location: FileLocation;
  metadata: FileMetadata | null;
  mode?: DocumentMode;
  modeConstraint?: DocumentModeConstraint;
  rawText: string;
};

export function createDocumentSession(
  input: CreateDocumentSessionInput
): DocumentSession {
  const modeConstraint = input.modeConstraint ?? "none";

  return {
    id: getDocumentSessionId(input.location),
    lastSavedMetadata: input.metadata,
    lastSavedText: input.rawText,
    lineEnding: input.lineEnding ?? detectLineEnding(input.rawText),
    location: input.location,
    mode: modeConstraint === "source-only" ? "source" : (input.mode ?? "rich"),
    modeConstraint,
    rawText: input.rawText,
    saveState: "idle"
  };
}

export function getDocumentSessionId(location: FileLocation): string {
  if (location.kind === "app-draft") {
    return `draft:${location.draftId}`;
  }

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
    session.location.kind === "app-draft" ||
    session.saveState === "conflict" ||
    session.saveState === "dirty" ||
    session.saveState === "error" ||
    session.saveState === "saving"
  );
}
