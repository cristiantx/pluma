import {
  applyLineEnding,
  updateDocumentSessionText,
  type DocumentSession
} from "@pluma/core";

import type {
  DesktopShellSnapshot,
  RendererEvent
} from "../../shared/shellState";

export type DocumentTextEditingDependencies = {
  getDocuments: () => DocumentSession[];
  getActiveDocumentForActiveTab: () => DocumentSession | null;
  updateShellData: (
    update: Partial<DesktopShellSnapshot>
  ) => DesktopShellSnapshot;
  getAutosaveEnabled: () => boolean;
  scheduleAutosave: (documentId: string) => void;
  clearAutosave: (documentId: string) => void;
  emitToRenderer: (event: RendererEvent) => void;
  persistSessionStateSoon: () => void;
  emitShellSnapshot: () => void;
};

export function createDocumentTextEditing(
  dependencies: DocumentTextEditingDependencies
) {
  function updateDocumentText(documentId: unknown, rawText: unknown): void {
    if (typeof documentId !== "string" || typeof rawText !== "string") {
      return;
    }

    const activeDocument = dependencies
      .getDocuments()
      .find((document) => document.id === documentId);

    if (!activeDocument || activeDocument.rawText === rawText) {
      return;
    }

    const nextDocument = updateDocumentSessionText(activeDocument, rawText);
    const nextDocuments = dependencies
      .getDocuments()
      .map((document) =>
        document.id === documentId ? nextDocument : document
      );

    dependencies.updateShellData({
      documents: nextDocuments,
      status: "Document edited."
    });

    if (nextDocument.saveState === "dirty") {
      if (
        nextDocument.location.kind === "app-draft" ||
        dependencies.getAutosaveEnabled()
      ) {
        dependencies.scheduleAutosave(documentId);
      } else {
        dependencies.clearAutosave(documentId);
      }
    } else {
      dependencies.clearAutosave(documentId);
    }
  }

  function convertActiveDocumentLineEndings(target: "crlf" | "lf"): void {
    const activeDocument = dependencies.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      dependencies.emitToRenderer({
        type: "status",
        message: "No active document to convert."
      });
      return;
    }

    const convertedText = applyLineEnding(activeDocument.rawText, target);
    const nextDocument: DocumentSession = {
      ...activeDocument,
      lineEnding: target,
      rawText: convertedText,
      saveState:
        convertedText === activeDocument.lastSavedText ? "idle" : "dirty"
    };

    if (
      nextDocument.rawText === activeDocument.rawText &&
      nextDocument.lineEnding === activeDocument.lineEnding
    ) {
      dependencies.updateShellData({
        status: `Line endings already ${target.toUpperCase()}.`
      });
      dependencies.emitShellSnapshot();
      return;
    }

    dependencies.updateShellData({
      documents: dependencies
        .getDocuments()
        .map((document) =>
          document.id === activeDocument.id ? nextDocument : document
        ),
      status: `Converted line endings to ${target.toUpperCase()}.`
    });

    if (
      dependencies.getAutosaveEnabled() &&
      nextDocument.saveState === "dirty"
    ) {
      dependencies.scheduleAutosave(nextDocument.id);
    }

    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
  }

  return {
    convertActiveDocumentLineEndings,
    updateDocumentText
  };
}
