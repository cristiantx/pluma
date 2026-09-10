import { dialog, type BrowserWindow } from "electron";
import { rename, stat } from "node:fs/promises";
import path from "node:path";

import type {
  DesktopFileLocation,
  DocumentSession,
  FileSystemAdapter
} from "@pluma/core";

import type {
  DesktopShellSnapshot,
  RendererEvent
} from "../../shared/shellState";
import {
  createSessionForFilePath,
  isPathInsideDirectory,
  type MarkdownModeAnalyzer
} from "../workspace/desktopWorkspace";

export type DocumentFileOperationsDependencies = {
  analyzeMarkdownMode: MarkdownModeAnalyzer;
  clearAutosave: (documentId: string) => void;
  closeDocumentSession: (documentId: string) => void;
  emitShellSnapshot: () => void;
  emitToRenderer: (event: RendererEvent) => void;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getActiveDocumentId: () => string | null;
  getActiveTabId: () => string | null;
  getAutosaveEnabled: () => boolean;
  getDocumentById: (documentId: string) => DocumentSession | null;
  getDocuments: () => DocumentSession[];
  getWorkspacePath: () => string | null;
  markSelfWritePath: (filePath: string) => void;
  persistSessionStateSoon: () => void;
  refreshWorkspaceEntries: () => Promise<void>;
  scheduleAutosave: (documentId: string) => void;
  syncEditorModeForActiveDocument: () => void;
  unmarkSelfWritePath: (filePath: string) => void;
  updateActiveFileWatcher: () => void;
  updateShellData: (update: Partial<DesktopShellSnapshot>) => void;
  window: BrowserWindow;
};

export function createDocumentFileOperations(
  dependencies: DocumentFileOperationsDependencies
) {
  async function renameDocument(documentId: string): Promise<void> {
    const document = dependencies.getDocumentById(documentId);

    if (!document || document.location.kind !== "desktop-path") {
      dependencies.emitToRenderer({
        type: "status",
        message: "Only desktop files can be renamed."
      });
      return;
    }

    const result = await dialog.showSaveDialog(dependencies.window, {
      buttonLabel: "Rename",
      defaultPath: document.location.path,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "Rename Markdown File"
    });

    if (result.canceled || !result.filePath) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Rename cancelled."
      });
      return;
    }

    const targetPath = result.filePath;

    if (targetPath === document.location.path) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Rename kept the same path."
      });
      return;
    }

    try {
      const existingTarget = await stat(targetPath).catch(() => null);

      if (existingTarget) {
        dependencies.emitToRenderer({
          type: "status",
          message: "Rename cancelled: target file already exists."
        });
        return;
      }

      dependencies.markSelfWritePath(document.location.path);
      dependencies.markSelfWritePath(targetPath);
      await rename(document.location.path, targetPath);
    } catch (error) {
      dependencies.emitToRenderer({
        type: "status",
        message:
          error instanceof Error
            ? `Rename failed: ${error.message}`
            : "Rename failed."
      });
      return;
    } finally {
      dependencies.unmarkSelfWritePath(document.location.path);
      dependencies.unmarkSelfWritePath(targetPath);
    }

    const nextSession = await createSessionForFilePath(
      dependencies.fileSystem,
      targetPath,
      dependencies.analyzeMarkdownMode
    );

    if (!nextSession) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Rename completed, but the renamed file could not be reopened."
      });
      dependencies.closeDocumentSession(document.id);
      await dependencies.refreshWorkspaceEntries();
      dependencies.persistSessionStateSoon();
      dependencies.emitShellSnapshot();
      return;
    }

    const renamedDocument: DocumentSession = {
      ...document,
      id: nextSession.id,
      lastSavedMetadata: nextSession.lastSavedMetadata,
      location: nextSession.location
    };

    dependencies.clearAutosave(document.id);
    if (
      dependencies.getAutosaveEnabled() &&
      renamedDocument.saveState === "dirty"
    ) {
      dependencies.scheduleAutosave(renamedDocument.id);
    }

    dependencies.updateShellData({
      activeDocumentId:
        dependencies.getActiveDocumentId() === document.id
          ? renamedDocument.id
          : dependencies.getActiveDocumentId(),
      activeTabId:
        dependencies.getActiveTabId() === document.id
          ? renamedDocument.id
          : dependencies.getActiveTabId(),
      documents: dependencies
        .getDocuments()
        .map((candidate) =>
          candidate.id === document.id ? renamedDocument : candidate
        ),
      status: `Renamed ${path.basename(document.location.path)} to ${path.basename(targetPath)}.`
    });
    dependencies.syncEditorModeForActiveDocument();
    dependencies.updateActiveFileWatcher();
    await dependencies.refreshWorkspaceEntries();
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
  }

  function revealDocumentInWorkspace(document: DocumentSession): void {
    const workspacePath = dependencies.getWorkspacePath();

    if (
      !workspacePath ||
      document.location.kind !== "desktop-path" ||
      !isPathInsideDirectory(workspacePath, document.location.path)
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "This file is not in the active workspace."
      });
      return;
    }

    dependencies.updateShellData({
      activeDocumentId: document.id,
      activeTabId: document.id,
      status: `Revealed ${path.basename(document.location.path)} in workspace.`
    });
    dependencies.updateActiveFileWatcher();
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
    dependencies.emitToRenderer({
      type: "reveal-workspace-file",
      path: document.location.path
    });
  }

  return { renameDocument, revealDocumentInWorkspace };
}
