import { dialog, type BrowserWindow } from "electron";
import path from "node:path";

import type { DocumentSession } from "@pluma/core";

export type ProtectedDocumentAction = "close-tab" | "quit" | "reload";

export async function confirmDiscardProtectedDocuments(
  window: BrowserWindow | null,
  documents: DocumentSession[],
  action: ProtectedDocumentAction
): Promise<boolean> {
  if (!window || documents.length === 0) {
    return true;
  }

  const detail =
    documents.length === 1
      ? `${getDocumentDisplayName(documents[0])} has unsaved, draft, saving, or conflicted changes.`
      : `${documents.length} documents have unsaved, saving, or conflicted changes:\n${formatDocumentNameList(documents)}`;
  const actionLabel =
    action === "quit" ? "Quit" : action === "reload" ? "Reload" : "Close";
  const result = await dialog.showMessageBox(window, {
    buttons: [actionLabel, "Cancel"],
    cancelId: 1,
    defaultId: 1,
    detail,
    message: `${actionLabel} anyway?`,
    noLink: true,
    type: "warning"
  });

  return result.response === 0;
}

export async function confirmDiscardDocumentsSequentially(
  window: BrowserWindow | null,
  documents: DocumentSession[]
): Promise<boolean> {
  for (const document of documents) {
    if (
      !(await confirmDiscardProtectedDocuments(window, [document], "close-tab"))
    ) {
      return false;
    }
  }

  return true;
}

function getDocumentDisplayName(document: DocumentSession | undefined): string {
  if (!document) {
    return "This document";
  }

  if (document.location.kind === "desktop-path") {
    return path.basename(document.location.path);
  }

  return document.location.name;
}

function formatDocumentNameList(documents: DocumentSession[]): string {
  const maxVisibleNames = 5;
  const visibleNames = documents
    .slice(0, maxVisibleNames)
    .map((document) => `- ${getDocumentDisplayName(document)}`);
  const remainingCount = documents.length - visibleNames.length;

  return remainingCount > 0
    ? `${visibleNames.join("\n")}\n- and ${remainingCount} more`
    : visibleNames.join("\n");
}
