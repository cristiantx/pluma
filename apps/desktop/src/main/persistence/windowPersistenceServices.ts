import { createDocumentTextEditing } from "../documents/documentTextEditing";
import { type BrowserWindow } from "electron";
import type { RendererEvent } from "../../shared/shellState";
import { AutosaveScheduler } from "../autosave/autosaveScheduler";
import type { createDocumentClosing } from "../documents/documentClosing";
import type { createDocumentModes } from "../documents/documentModes";
import type { createDocumentOpening } from "../documents/documentOpening";
import { createDocumentReconciliation } from "../documents/documentReconciliation";
import { createDocumentReload } from "../documents/documentReload";
import { createDocumentSaveText } from "../documents/documentSaveText";
import { createDocumentSaving } from "../documents/documentSaving";
import type { createDocumentTabs } from "../documents/documentTabs";
import { createDraftDocumentPersistence } from "../documents/draftDocumentPersistence";
import { createWindowDocumentReferenceLoader } from "../session/windowDocumentReferenceLoader";
import { ActiveFileWatcher } from "../watching/activeFileWatcher";
import type { DesktopWindowSessionDependencies } from "../windows/windowSessionDependencies";
import type { WindowSessionState } from "../windows/windowSessionState";
import type { WindowWorkspaceCoordinator } from "../workspace/windowWorkspaceCoordinator";
import { DocumentSaveQueue } from "./documentSaveQueue";
export type WindowPersistenceServicesPorts = {
  dependencies: DesktopWindowSessionDependencies;
  window: BrowserWindow;
  state: WindowSessionState;
  modes: ReturnType<typeof createDocumentModes>;
  selfWritePaths: Set<string>;
  getClosing(): ReturnType<typeof createDocumentClosing>;
  getOpening(): ReturnType<typeof createDocumentOpening>;
  getDocumentTabs(): ReturnType<typeof createDocumentTabs>;
  getWorkspace(): WindowWorkspaceCoordinator;
  emitToRenderer(event: RendererEvent): void;
  emitShellSnapshot(): void;
  persistSessionStateSoon(): void;
};
export function createWindowPersistenceServices(
  ports: WindowPersistenceServicesPorts
) {
  const saveQueue = new DocumentSaveQueue();
  const draftPersistence = createDraftDocumentPersistence({
    analyzeMarkdownMode: ports.dependencies.analyzeMarkdownMode,
    draftStorage: ports.dependencies.draftStorage,
    fileSystem: ports.dependencies.fileSystem,
    window: ports.window,
    clearAutosaveTimer: (id) => autosaveScheduler.clear(id),
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    getDefaultSaveAsPath: (...args) =>
      ports.getOpening().getDefaultSaveAsPath(...args),
    getDocuments: () => ports.state.value.documents,
    persistSessionStateSoon: (...args) =>
      ports.persistSessionStateSoon(...args),
    prepareTextForSave: (...args) => saveText.prepareTextForSave(...args),
    refreshWorkspaceEntries: (...args) => ports.getWorkspace().refresh(...args),
    replaceDocumentSession: (...args) =>
      ports.getDocumentTabs().replaceDocumentSession(...args),
    updateShellData: (...args) => ports.state.update(...args),
    waitForSave: async (id) => {
      await saveQueue.waitFor(id);
    }
  });
  const reconciliation = createDocumentReconciliation({
    analyzeMarkdownMode: ports.dependencies.analyzeMarkdownMode,
    clearAutosave: (id) => autosaveScheduler.clear(id),
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    fileSystem: ports.dependencies.fileSystem,
    getActiveDocument: (...args) => ports.state.getActiveDocument(...args),
    getDocumentById: (...args) => ports.state.getDocumentById(...args),
    getDocuments: () => ports.state.value.documents,
    isSelfWritePath: (path) => ports.selfWritePaths.has(path),
    updateShellData: (...args) => ports.state.update(...args)
  });
  const reload = createDocumentReload({
    analyzeMarkdownMode: ports.dependencies.analyzeMarkdownMode,
    confirmDiscardProtectedDocuments: (...args) =>
      ports.getClosing().confirmDiscardProtectedDocuments(...args),
    confirmReloadConflictedDocument: (...args) =>
      ports.getClosing().confirmReloadConflictedDocument(...args),
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    fileSystem: ports.dependencies.fileSystem,
    getActiveDocumentForActiveTab: (...args) =>
      ports.state.getActiveDocumentForActiveTab(...args),
    getDocuments: () => ports.state.value.documents,
    syncEditorModeForActiveDocument: (...args) =>
      ports.modes.syncEditorModeForActiveDocument(...args),
    updateShellData: (...args) => ports.state.update(...args)
  });
  const saveText = createDocumentSaveText(
    ports.dependencies.getDefaultLineEnding
  );
  const saving = createDocumentSaving({
    window: ports.window,
    fileSystem: ports.dependencies.fileSystem,
    enqueueDocumentSave: (id, operation) => saveQueue.enqueue(id, operation),
    clearAutosave: (id) => autosaveScheduler.clear(id),
    getDocuments: () => ports.state.value.documents,
    getDocumentById: (...args) => ports.state.getDocumentById(...args),
    getActiveDocumentForActiveTab: (...args) =>
      ports.state.getActiveDocumentForActiveTab(...args),
    getDefaultSaveAsPath: (...args) =>
      ports.getOpening().getDefaultSaveAsPath(...args),
    saveDraftDocument: (...args) => draftPersistence.saveDraftDocument(...args),
    promoteDraftDocumentResult: (...args) =>
      draftPersistence.promoteDraftDocumentResult(...args),
    promoteDraftDocument: (...args) =>
      draftPersistence.promoteDraftDocument(...args),
    prepareTextForSave: (...args) => saveText.prepareTextForSave(...args),
    markSelfWritePath: (path) => {
      ports.selfWritePaths.add(path);
    },
    unmarkSelfWritePath: (path) => {
      ports.selfWritePaths.delete(path);
    },
    updateState: (update) => ports.state.update(update),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    persistSessionStateSoon: (...args) =>
      ports.persistSessionStateSoon(...args),
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    openFilePath: (...args) => ports.getOpening().openFilePath(...args),
    refreshWorkspace: () => ports.getWorkspace().refresh()
  });
  const referenceLoader = createWindowDocumentReferenceLoader(
    ports.dependencies
  );
  const autosaveScheduler = new AutosaveScheduler(
    ports.dependencies.autosaveDelayMs,
    (documentId) => {
      void saving.saveDocument(documentId, "autosave");
    }
  );
  const activeFileWatcher = new ActiveFileWatcher(
    (filePath) => {
      void reconciliation.handleActiveFileExternalChange(filePath);
    },
    (message) => ports.emitToRenderer({ type: "status", message })
  );
  const textEditing = createDocumentTextEditing({
    getDocuments: () => ports.state.value.documents,
    getActiveDocumentForActiveTab: () =>
      ports.state.getActiveDocumentForActiveTab(),
    updateShellData: (update) => ports.state.update(update),
    getAutosaveEnabled: ports.dependencies.getAutosaveEnabled,
    scheduleAutosave: (id) => autosaveScheduler.schedule(id),
    clearAutosave: (id) => autosaveScheduler.clear(id),
    emitToRenderer: ports.emitToRenderer,
    persistSessionStateSoon: ports.persistSessionStateSoon,
    emitShellSnapshot: ports.emitShellSnapshot
  });
  return {
    textEditing,
    saveQueue,
    saveText,
    draftPersistence,
    reconciliation,
    reload,
    saving,
    referenceLoader,
    autosaveScheduler,
    activeFileWatcher
  };
}
