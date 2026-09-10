import { type DocumentSession } from "@pluma/core";
import type { EditorViewMode, RendererEvent } from "../../shared/shellState";
import { type PersistedDocumentReference } from "../persistence/appPersistence";
import { getPersistedDocumentReference } from "../windows/persistedDocumentRefs";
export type DocumentModeDependencies = {
  getActiveDocument(): DocumentSession | null;
  getDocuments(): DocumentSession[];
  emitToRenderer(event: RendererEvent): void;
  emitShellSnapshot(): void;
};
export function createDocumentModes(dependencies: DocumentModeDependencies) {
  let currentMode: EditorViewMode = "source";
  const documentModes = new Map<string, EditorViewMode>();
  function getAllowedEditorMode(
    document: DocumentSession | null,
    mode: EditorViewMode
  ): EditorViewMode {
    return mode !== "source" && document?.modeConstraint === "source-only"
      ? "source"
      : mode;
  }

  function getNextEditorMode(): EditorViewMode {
    const activeDocument = dependencies.getActiveDocument();
    const cycle: EditorViewMode[] = ["source", "rich", "preview"];
    const currentMode = getStoredDocumentMode(activeDocument);
    const currentIndex = cycle.indexOf(currentMode);
    const nextMode = cycle[(currentIndex + 1) % cycle.length] ?? "source";

    return getAllowedEditorMode(activeDocument, nextMode);
  }

  function getStoredDocumentMode(
    document: DocumentSession | null
  ): EditorViewMode {
    if (!document) {
      return currentMode;
    }

    return (
      documentModes.get(getDocumentModeKey(document)) ??
      getDefaultDocumentMode(document)
    );
  }

  function getDefaultDocumentMode(document: DocumentSession): EditorViewMode {
    return document.modeConstraint === "source-only" ? "source" : "rich";
  }

  function getDocumentModeKey(document: DocumentSession): string {
    if (document.location.kind === "app-draft") {
      return `app-draft:${document.location.draftId}`;
    }

    if (document.location.kind === "desktop-path") {
      return `desktop-path:${document.location.path}`;
    }

    return document.id;
  }

  function setStoredDocumentMode(
    document: DocumentSession,
    mode: EditorViewMode
  ): void {
    documentModes.set(
      getDocumentModeKey(document),
      getAllowedEditorMode(document, mode)
    );
  }

  function getDocumentViewModesSnapshot(): Record<string, EditorViewMode> {
    return Object.fromEntries(
      dependencies
        .getDocuments()
        .map((document) => [
          document.id,
          getAllowedEditorMode(document, getStoredDocumentMode(document))
        ])
    );
  }

  function getPersistedDocumentReferenceWithMode(
    document: DocumentSession
  ): PersistedDocumentReference | null {
    const documentRef = getPersistedDocumentReference(document);

    if (!documentRef) {
      return null;
    }

    return {
      ...documentRef,
      editorMode: getAllowedEditorMode(
        document,
        getStoredDocumentMode(document)
      )
    };
  }

  function setModeForActiveDocument(mode: EditorViewMode): void {
    const activeDocument = dependencies.getActiveDocument();
    const previousMode = currentMode;

    if (activeDocument) {
      setStoredDocumentMode(activeDocument, mode);
    }

    currentMode = getAllowedEditorMode(activeDocument, mode);
    dependencies.emitToRenderer({ type: "mode-changed", mode: currentMode });

    if (previousMode !== currentMode) {
      dependencies.emitShellSnapshot();
    }
  }

  function syncEditorModeForActiveDocument(
    options: { emit?: boolean } = {}
  ): void {
    const previousMode = currentMode;
    const activeDocument = dependencies.getActiveDocument();
    currentMode = getAllowedEditorMode(
      activeDocument,
      getStoredDocumentMode(activeDocument)
    );

    if (options.emit !== false && previousMode !== currentMode) {
      dependencies.emitToRenderer({ type: "mode-changed", mode: currentMode });
    }
  }
  return {
    getAllowedEditorMode,
    getNextEditorMode,
    getStoredDocumentMode,
    getDefaultDocumentMode,
    getDocumentModeKey,
    setStoredDocumentMode,
    getDocumentViewModesSnapshot,
    getPersistedDocumentReferenceWithMode,
    setModeForActiveDocument,
    syncEditorModeForActiveDocument,
    documentModes,
    get currentMode() {
      return currentMode;
    },
    set currentMode(mode: EditorViewMode) {
      currentMode = mode;
    }
  };
}
