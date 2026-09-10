import path from "node:path";

import {
  createDocumentSession,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";
import { dialog, type BrowserWindow } from "electron";

import type {
  DesktopShellSnapshot,
  RendererEvent
} from "../../shared/shellState";
import type { MarkdownModeAnalyzer } from "../workspace/desktopWorkspace";
import { createSessionForFilePath } from "../workspace/desktopWorkspace";
import type { AppDraftStorage } from "../persistence/appDraftStorage";
import { markDocumentAfterSuccessfulWrite } from "../windows/documentSaveState";

export type DraftDocumentPersistenceDependencies = {
  analyzeMarkdownMode: MarkdownModeAnalyzer;
  draftStorage: AppDraftStorage;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  window: BrowserWindow;
  clearAutosaveTimer: (documentId: string) => void;
  emitShellSnapshot: () => void;
  emitToRenderer: (event: RendererEvent) => void;
  getDefaultSaveAsPath: (document: DocumentSession) => string;
  getDocuments: () => DocumentSession[];
  persistSessionStateSoon: () => void;
  prepareTextForSave: (document: DocumentSession, text?: string) => string;
  refreshWorkspaceEntries: () => Promise<void>;
  replaceDocumentSession: (
    documentId: string,
    nextSession: DocumentSession
  ) => void;
  updateShellData: (
    update: Partial<DesktopShellSnapshot>
  ) => DesktopShellSnapshot;
  waitForSave: (documentId: string) => Promise<void>;
};

export function createDraftDocumentPersistence(
  dependencies: DraftDocumentPersistenceDependencies
) {
  async function saveDraftDocument(
    document: DocumentSession
  ): Promise<boolean> {
    if (document.location.kind !== "app-draft") {
      return false;
    }

    dependencies.clearAutosaveTimer(document.id);
    const savedText = document.rawText;
    const metadata = await dependencies.draftStorage.writeDraft(
      document.location,
      savedText
    );
    dependencies.updateShellData({
      documents: dependencies
        .getDocuments()
        .map((candidate) =>
          candidate.id === document.id
            ? markDocumentAfterSuccessfulWrite(
                candidate,
                savedText,
                metadata,
                savedText
              )
            : candidate
        ),
      status: `Draft saved for ${document.location.name}.`
    });
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
    return true;
  }

  async function promoteDraftDocument(
    document: DocumentSession
  ): Promise<boolean> {
    if (document.location.kind !== "app-draft") {
      return false;
    }

    const result = await dialog.showSaveDialog(dependencies.window, {
      defaultPath: dependencies.getDefaultSaveAsPath(document),
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "Save Markdown File"
    });

    if (result.canceled || !result.filePath) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Save cancelled."
      });
      return false;
    }

    const textToSave = dependencies.prepareTextForSave(document);
    const fileLocation = {
      kind: "desktop-path" as const,
      path: result.filePath
    };
    const saveResult = await dependencies.fileSystem.writeTextAtomic(
      fileLocation,
      textToSave
    );

    if (saveResult.kind !== "success") {
      dependencies.emitToRenderer({
        type: "status",
        message:
          saveResult.kind === "conflict"
            ? `Save conflict: file was ${saveResult.reason}.`
            : `Save failed: ${saveResult.message}`
      });
      return false;
    }

    await dependencies.draftStorage.deleteDraft(document.location);
    const nextSession =
      (await createSessionForFilePath(
        dependencies.fileSystem,
        result.filePath,
        dependencies.analyzeMarkdownMode
      )) ??
      createDocumentSession({
        location: fileLocation,
        metadata: saveResult.metadata,
        rawText: textToSave
      });

    dependencies.clearAutosaveTimer(document.id);
    dependencies.replaceDocumentSession(document.id, nextSession);
    dependencies.updateShellData({
      status: `Saved ${path.basename(result.filePath)}.`
    });
    await dependencies.refreshWorkspaceEntries();
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
    return true;
  }

  function deleteDraftSoon(document: DocumentSession): void {
    if (document.location.kind !== "app-draft") {
      return;
    }

    const draftLocation = document.location;
    const pendingSave = dependencies.waitForSave(document.id);
    void pendingSave
      .then(() => dependencies.draftStorage.deleteDraft(draftLocation))
      .catch((error) => {
        dependencies.emitToRenderer({
          type: "status",
          message:
            error instanceof Error
              ? `Could not delete draft: ${error.message}`
              : "Could not delete draft."
        });
      });
  }

  return {
    deleteDraftSoon,
    promoteDraftDocument,
    saveDraftDocument
  };
}
