import {
  markDocumentSessionConflict,
  markDocumentSessionExternalChange,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import type { DesktopShellSnapshot } from "../../shared/shellState";
import {
  createSessionForFilePath,
  type MarkdownModeAnalyzer
} from "../workspace/desktopWorkspace";

export type DocumentReconciliationDependencies = {
  analyzeMarkdownMode: MarkdownModeAnalyzer;
  clearAutosave: (documentId: string) => void;
  emitShellSnapshot: () => void;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getActiveDocument: () => DocumentSession | null;
  getDocumentById: (documentId: string) => DocumentSession | null;
  getDocuments: () => DocumentSession[];
  isSelfWritePath: (filePath: string) => boolean;
  updateShellData: (update: Partial<DesktopShellSnapshot>) => void;
};

export function createDocumentReconciliation(
  dependencies: DocumentReconciliationDependencies
) {
  async function reconcileDocumentWithDisk(
    documentId: string,
    options: { emitSnapshot: boolean }
  ): Promise<void> {
    const documentToReconcile = dependencies.getDocumentById(documentId);

    if (
      !documentToReconcile ||
      documentToReconcile.location.kind !== "desktop-path" ||
      dependencies.isSelfWritePath(documentToReconcile.location.path)
    ) {
      return;
    }

    const currentMetadata = await dependencies.fileSystem.getMetadata(
      documentToReconcile.location
    );

    if (!currentMetadata) {
      dependencies.updateShellData({
        documents: dependencies
          .getDocuments()
          .map((document) =>
            document.id === documentToReconcile.id
              ? markDocumentSessionConflict(document)
              : document
          ),
        status: "Active file was deleted on disk."
      });
      if (options.emitSnapshot) {
        dependencies.emitShellSnapshot();
      }
      return;
    }

    if (
      documentToReconcile.lastSavedMetadata &&
      currentMetadata.mtimeMs ===
        documentToReconcile.lastSavedMetadata.mtimeMs &&
      currentMetadata.size === documentToReconcile.lastSavedMetadata.size &&
      currentMetadata.fileId === documentToReconcile.lastSavedMetadata.fileId
    ) {
      return;
    }

    dependencies.clearAutosave(documentToReconcile.id);

    if (documentToReconcile.rawText === documentToReconcile.lastSavedText) {
      const nextSession = await createSessionForFilePath(
        dependencies.fileSystem,
        documentToReconcile.location.path,
        dependencies.analyzeMarkdownMode
      );

      if (!nextSession) {
        dependencies.updateShellData({
          documents: dependencies
            .getDocuments()
            .map((document) =>
              document.id === documentToReconcile.id
                ? markDocumentSessionConflict(document)
                : document
            ),
          status: "Active file changed on disk but could not be reloaded."
        });
        if (options.emitSnapshot) {
          dependencies.emitShellSnapshot();
        }
        return;
      }

      dependencies.updateShellData({
        documents: dependencies
          .getDocuments()
          .map((document) =>
            document.id === documentToReconcile.id ? nextSession : document
          ),
        status: "Active file reloaded from disk."
      });
      if (options.emitSnapshot) {
        dependencies.emitShellSnapshot();
      }
      return;
    }

    dependencies.updateShellData({
      documents: dependencies
        .getDocuments()
        .map((document) =>
          document.id === documentToReconcile.id
            ? markDocumentSessionExternalChange(document)
            : document
        ),
      status: "Active file changed on disk."
    });
    if (options.emitSnapshot) {
      dependencies.emitShellSnapshot();
    }
  }

  async function handleActiveFileExternalChange(
    filePath: string
  ): Promise<void> {
    const activeDocument = dependencies.getActiveDocument();

    if (
      !activeDocument ||
      activeDocument.location.kind !== "desktop-path" ||
      activeDocument.location.path !== filePath
    ) {
      return;
    }

    await reconcileDocumentWithDisk(activeDocument.id, {
      emitSnapshot: true
    });
  }

  return { handleActiveFileExternalChange, reconcileDocumentWithDisk };
}
