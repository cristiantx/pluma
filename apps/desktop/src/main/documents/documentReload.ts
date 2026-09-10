import path from "node:path";

import {
  shouldProtectDocumentSessionClose,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import type {
  DesktopShellSnapshot,
  RendererEvent
} from "../../shared/shellState";
import {
  createSessionForFilePath,
  type MarkdownModeAnalyzer
} from "../workspace/desktopWorkspace";

export type DocumentReloadDependencies = {
  analyzeMarkdownMode: MarkdownModeAnalyzer;
  confirmDiscardProtectedDocuments: (
    documents: DocumentSession[],
    reason: "reload"
  ) => Promise<boolean>;
  confirmReloadConflictedDocument: () => Promise<boolean>;
  emitShellSnapshot: () => void;
  emitToRenderer: (event: RendererEvent) => void;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getActiveDocumentForActiveTab: () => DocumentSession | null;
  getDocuments: () => DocumentSession[];
  syncEditorModeForActiveDocument: () => void;
  updateShellData: (update: Partial<DesktopShellSnapshot>) => void;
};

export function createDocumentReload(dependencies: DocumentReloadDependencies) {
  async function reloadActiveDocumentFromDisk(): Promise<void> {
    const activeDocument = dependencies.getActiveDocumentForActiveTab();

    if (!activeDocument || activeDocument.location.kind !== "desktop-path") {
      dependencies.emitToRenderer({
        type: "status",
        message: "No desktop file to reload."
      });
      return;
    }

    if (
      activeDocument.saveState === "conflict" &&
      !(await dependencies.confirmReloadConflictedDocument())
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Reload cancelled."
      });
      return;
    }

    if (
      activeDocument.saveState !== "conflict" &&
      shouldProtectDocumentSessionClose(activeDocument) &&
      !(await dependencies.confirmDiscardProtectedDocuments(
        [activeDocument],
        "reload"
      ))
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Reload cancelled."
      });
      return;
    }

    const nextSession = await createSessionForFilePath(
      dependencies.fileSystem,
      activeDocument.location.path,
      dependencies.analyzeMarkdownMode
    );

    if (!nextSession) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Could not reload file from disk."
      });
      return;
    }

    dependencies.updateShellData({
      documents: dependencies
        .getDocuments()
        .map((document) =>
          document.id === activeDocument.id ? nextSession : document
        ),
      status: `Reloaded ${path.basename(activeDocument.location.path)} from disk.`
    });
    dependencies.syncEditorModeForActiveDocument();
    dependencies.emitShellSnapshot();
    dependencies.emitToRenderer({
      type: "document-baseline-reset",
      documentId: activeDocument.id
    });
  }

  async function keepEditingActiveDocument(): Promise<void> {
    const activeDocument = dependencies.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      return;
    }

    const metadata =
      activeDocument.location.kind === "desktop-path"
        ? await dependencies.fileSystem.getMetadata(activeDocument.location)
        : activeDocument.lastSavedMetadata;

    dependencies.updateShellData({
      documents: dependencies.getDocuments().map((document) =>
        document.id === activeDocument.id
          ? {
              ...document,
              lastSavedMetadata: metadata,
              saveState: "dirty"
            }
          : document
      ),
      status: "Kept in-memory edits. The next save will write over disk."
    });
    dependencies.emitShellSnapshot();
  }

  return { keepEditingActiveDocument, reloadActiveDocumentFromDisk };
}
