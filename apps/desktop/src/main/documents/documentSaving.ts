import path from "node:path";

import {
  markDocumentSessionConflict,
  markDocumentSessionSaveError,
  markDocumentSessionSaving,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";
import { dialog, type BrowserWindow } from "electron";

import type { RendererEvent } from "../../shared/shellState.js";
import { markDocumentAfterSuccessfulWrite } from "../windows/documentSaveState.js";

type SaveTrigger = "autosave" | "manual";

type DocumentStateUpdate = {
  documents?: DocumentSession[];
  status?: string;
};

export type DocumentSavingDependencies = {
  window: BrowserWindow;
  fileSystem: Pick<FileSystemAdapter<DesktopFileLocation>, "writeTextAtomic">;
  enqueueDocumentSave(
    documentId: string,
    operation: () => Promise<boolean>
  ): Promise<boolean>;
  clearAutosave(documentId: string): void;
  getDocuments(): DocumentSession[];
  getDocumentById(documentId: string): DocumentSession | null;
  getActiveDocumentForActiveTab(): DocumentSession | null;
  getDefaultSaveAsPath(document: DocumentSession): string;
  saveDraftDocument(document: DocumentSession): Promise<boolean>;
  promoteDraftDocument(document: DocumentSession): Promise<boolean>;
  prepareTextForSave(document: DocumentSession, text?: string): string;
  markSelfWritePath(filePath: string): void;
  unmarkSelfWritePath(filePath: string): void;
  updateState(update: DocumentStateUpdate): void;
  emitToRenderer(event: RendererEvent): void;
  persistSessionStateSoon(): void;
  emitShellSnapshot(): void;
  openFilePath(filePath: string): Promise<void>;
  refreshWorkspace(): Promise<void>;
};

export type DocumentSaving = {
  saveDocument(documentId: string, trigger: SaveTrigger): Promise<boolean>;
  performSaveDocument(
    documentId: string,
    trigger: SaveTrigger
  ): Promise<boolean>;
  saveActiveDocument(): Promise<void>;
  saveActiveDocumentAs(): Promise<void>;
};

export function createDocumentSaving(
  dependencies: DocumentSavingDependencies
): DocumentSaving {
  const saveActiveDocument = async (): Promise<void> => {
    const activeDocument = dependencies.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      dependencies.emitToRenderer({
        type: "status",
        message: "No active document to save."
      });
      return;
    }

    await saveDocument(activeDocument.id, "manual");
  };

  const saveActiveDocumentAs = async (): Promise<void> => {
    const activeDocument = dependencies.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      dependencies.emitToRenderer({
        type: "status",
        message: "No active document to save."
      });
      return;
    }

    if (activeDocument.location.kind === "app-draft") {
      await dependencies.promoteDraftDocument(activeDocument);
      return;
    }

    const result = await dialog.showSaveDialog(dependencies.window, {
      defaultPath: dependencies.getDefaultSaveAsPath(activeDocument),
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "Save Markdown File As"
    });

    if (result.canceled || !result.filePath) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Save As cancelled."
      });
      return;
    }

    const textToSave = dependencies.prepareTextForSave(activeDocument);
    const saveResult = await dependencies.fileSystem.writeTextAtomic(
      { kind: "desktop-path", path: result.filePath },
      textToSave
    );

    if (saveResult.kind !== "success") {
      dependencies.emitToRenderer({
        type: "status",
        message:
          saveResult.kind === "conflict"
            ? `Save As conflict: file was ${saveResult.reason}.`
            : `Save As failed: ${saveResult.message}`
      });
      return;
    }

    await dependencies.openFilePath(result.filePath);
    await dependencies.refreshWorkspace();
  };

  const saveDocument = (
    documentId: string,
    trigger: SaveTrigger
  ): Promise<boolean> =>
    dependencies.enqueueDocumentSave(documentId, () =>
      performSaveDocument(documentId, trigger).catch((error: unknown) => {
        const document = dependencies.getDocumentById(documentId);

        if (document) {
          dependencies.updateState({
            documents: dependencies
              .getDocuments()
              .map((candidate) =>
                candidate.id === documentId
                  ? markDocumentSessionSaveError(candidate)
                  : candidate
              ),
            status:
              error instanceof Error
                ? `Save failed: ${error.message}`
                : "Save failed."
          });
          dependencies.emitShellSnapshot();
        }

        return false;
      })
    );

  const performSaveDocument = async (
    documentId: string,
    trigger: SaveTrigger
  ): Promise<boolean> => {
    const activeDocument = dependencies
      .getDocuments()
      .find((document) => document.id === documentId);

    if (!activeDocument) {
      return false;
    }

    if (activeDocument.saveState === "idle") {
      if (
        trigger === "manual" &&
        activeDocument.location.kind === "app-draft"
      ) {
        return dependencies.promoteDraftDocument(activeDocument);
      }

      return true;
    }

    if (
      activeDocument.saveState === "conflict" ||
      activeDocument.saveState === "external-change"
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Resolve the disk conflict before saving."
      });
      return false;
    }

    if (activeDocument.location.kind === "app-draft") {
      if (trigger === "autosave") {
        return dependencies.saveDraftDocument(activeDocument);
      }

      return dependencies.promoteDraftDocument(activeDocument);
    }

    if (activeDocument.location.kind !== "desktop-path") {
      dependencies.emitToRenderer({
        type: "status",
        message: "Save is only available for desktop files."
      });
      return false;
    }

    dependencies.clearAutosave(activeDocument.id);
    const textToSave = dependencies.prepareTextForSave(
      activeDocument,
      activeDocument.rawText
    );

    dependencies.updateState({
      documents: dependencies
        .getDocuments()
        .map((document) =>
          document.id === activeDocument.id
            ? markDocumentSessionSaving(document)
            : document
        ),
      status:
        trigger === "autosave"
          ? `Autosaving ${path.basename(activeDocument.location.path)}.`
          : `Saving ${path.basename(activeDocument.location.path)}.`
    });
    dependencies.emitShellSnapshot();

    const activeDocumentPath = activeDocument.location.path;

    dependencies.markSelfWritePath(activeDocumentPath);
    const saveResult = await dependencies.fileSystem.writeTextAtomic(
      activeDocument.location,
      textToSave,
      { expectedMetadata: activeDocument.lastSavedMetadata }
    );
    setTimeout(() => {
      dependencies.unmarkSelfWritePath(activeDocumentPath);
    }, 150);

    if (saveResult.kind === "success") {
      dependencies.updateState({
        documents: dependencies
          .getDocuments()
          .map((document) =>
            document.id === activeDocument.id
              ? markDocumentAfterSuccessfulWrite(
                  document,
                  textToSave,
                  saveResult.metadata,
                  activeDocument.rawText
                )
              : document
          ),
        status:
          trigger === "autosave"
            ? `Autosaved ${path.basename(activeDocument.location.path)}.`
            : `Saved ${path.basename(activeDocument.location.path)}.`
      });
      dependencies.persistSessionStateSoon();
      dependencies.emitShellSnapshot();
      return true;
    }

    if (saveResult.kind === "conflict") {
      dependencies.updateState({
        documents: dependencies
          .getDocuments()
          .map((document) =>
            document.id === activeDocument.id
              ? markDocumentSessionConflict(document)
              : document
          ),
        status: `Save conflict: file was ${saveResult.reason}.`
      });
      dependencies.emitShellSnapshot();
      return false;
    }

    dependencies.updateState({
      documents: dependencies.getDocuments().map((document) =>
        document.id === activeDocument.id
          ? markDocumentSessionSaveError({
              ...document,
              rawText: textToSave
            })
          : document
      ),
      status: `Save failed: ${saveResult.message}`
    });
    dependencies.emitShellSnapshot();
    return false;
  };

  return {
    performSaveDocument,
    saveActiveDocument,
    saveActiveDocumentAs,
    saveDocument
  };
}
