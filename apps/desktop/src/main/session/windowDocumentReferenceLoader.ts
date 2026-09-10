import {
  createDocumentSession,
  type AppDraftFileLocation,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";
import type { AppDraftStorage } from "../persistence/appDraftStorage";
import { type PersistedDocumentReference } from "../persistence/appPersistence";
import {
  tryCreateSessionForFilePath,
  type MarkdownModeAnalyzer
} from "../workspace/desktopWorkspace";
export type WindowDocumentReferenceLoaderDependencies = {
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  draftStorage: AppDraftStorage;
  analyzeMarkdownMode: MarkdownModeAnalyzer;
};
export function createWindowDocumentReferenceLoader(
  dependencies: WindowDocumentReferenceLoaderDependencies
) {
  async function createSessionForPersistedDocumentRef(
    documentRef: PersistedDocumentReference
  ): Promise<DocumentSession | null> {
    if (documentRef.kind === "desktop-path") {
      return tryCreateSessionForFilePath(
        dependencies.fileSystem,
        documentRef.path,
        dependencies.analyzeMarkdownMode
      );
    }

    const location: AppDraftFileLocation = {
      draftId: documentRef.draftId,
      kind: "app-draft",
      name: documentRef.name
    };
    const rawText = await dependencies.draftStorage.readDraft(location);

    if (rawText === null) {
      return null;
    }

    const modeConstraint = await dependencies.analyzeMarkdownMode(rawText);

    return createDocumentSession({
      location,
      metadata: null,
      mode: modeConstraint === "source-only" ? "source" : "rich",
      modeConstraint,
      rawText
    });
  }
  return { createSessionForPersistedDocumentRef };
}
