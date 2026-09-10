import { type DocumentSession } from "@pluma/core";
import { type BrowserWindow } from "electron";
import type { RendererEvent } from "../../shared/shellState";
import type { createWindowPersistenceServices } from "../persistence/windowPersistenceServices";
import type { DesktopWindowSessionDependencies } from "../windows/windowSessionDependencies";
import type { WindowSessionState } from "../windows/windowSessionState";
import type { createWindowWorkspaceActions } from "../workspace/windowWorkspaceActions";
import type { WindowWorkspaceCoordinator } from "../workspace/windowWorkspaceCoordinator";
import { createDocumentClosing } from "./documentClosing";
import { createDocumentFileOperations } from "./documentFileOperations";
import type { createDocumentModes } from "./documentModes";
import { createDocumentOpening } from "./documentOpening";
import { createDocumentTabs } from "./documentTabs";
export type WindowDocumentServicesPorts = {
  dependencies: DesktopWindowSessionDependencies;
  window: BrowserWindow;
  state: WindowSessionState;
  modes: ReturnType<typeof createDocumentModes>;
  selfWritePaths: Set<string>;
  getPersistence(): ReturnType<typeof createWindowPersistenceServices>;
  getWorkspace(): WindowWorkspaceCoordinator;
  getWorkspaceActions(): ReturnType<typeof createWindowWorkspaceActions>;
  emitToRenderer(event: RendererEvent): void;
  emitShellSnapshot(): void;
  persistSessionStateSoon(): void;
  getProtectedDocuments(): DocumentSession[];
  updateActiveFileWatcher(): void;
  updateWorkspaceWatcher(): void;
};
export function createWindowDocumentServices(
  ports: WindowDocumentServicesPorts
) {
  const documentTabs = createDocumentTabs({
    getShellData: () => ports.state.value,
    updateShellData: (value) => ports.state.update(value),
    syncEditorModeForActiveDocument: () =>
      ports.modes.syncEditorModeForActiveDocument(),
    updateActiveFileWatcher: () => ports.updateActiveFileWatcher(),
    getDocumentById: (id) => ports.state.getDocumentById(id),
    deleteDraftSoon: (document) =>
      ports.getPersistence().draftPersistence.deleteDraftSoon(document),
    clearAutosave: (id) => ports.getPersistence().autosaveScheduler.clear(id)
  });
  const closing = createDocumentClosing({
    window: ports.window,
    getActiveDocumentForActiveTab: (...args) =>
      ports.state.getActiveDocumentForActiveTab(...args),
    getDocumentById: (...args) => ports.state.getDocumentById(...args),
    getProtectedDocuments: (...args) => ports.getProtectedDocuments(...args),
    getCurrentDocumentIdForClose: (...args) =>
      documentTabs.getCurrentDocumentIdForClose(...args),
    closeDocumentSession: (...args) =>
      documentTabs.closeDocumentSession(...args),
    closeDocumentSessionsWithOptions: (...args) =>
      documentTabs.closeDocumentSessionsWithOptions(...args),
    saveDocument: (...args) =>
      ports.getPersistence().saving.saveDocument(...args),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    persistSessionStateSoon: (...args) => ports.persistSessionStateSoon(...args)
  });
  const opening = createDocumentOpening({
    analyzeMarkdownMode: ports.dependencies.analyzeMarkdownMode,
    appDocumentsPath: ports.dependencies.appDocumentsPath,
    draftStorage: ports.dependencies.draftStorage,
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    fileSystem: ports.dependencies.fileSystem,
    getCurrentMode: () => ports.modes.currentMode,
    getDefaultLineEnding: ports.dependencies.getDefaultLineEnding,
    getDocumentByDesktopPath: (...args) =>
      ports.state.getDocumentByDesktopPath(...args),
    getDocuments: () => ports.state.value.documents,
    getWorkspaceEntries: () => ports.state.value.workspaceEntries,
    getWorkspacePath: () => ports.state.value.workspacePath,
    mergeDocumentSession: (...args) =>
      documentTabs.mergeDocumentSession(...args),
    openFolderPath: (...args) =>
      ports.getWorkspaceActions().openFolderPath(...args),
    persistSessionStateSoon: (...args) =>
      ports.persistSessionStateSoon(...args),
    syncEditorModeForActiveDocument: (...args) =>
      ports.modes.syncEditorModeForActiveDocument(...args),
    updateActiveFileWatcher: (...args) =>
      ports.updateActiveFileWatcher(...args),
    updateShellData: (...args) => ports.state.update(...args),
    updateWorkspaceWatcher: (...args) => ports.updateWorkspaceWatcher(...args),
    window: ports.window
  });
  const fileOperations = createDocumentFileOperations({
    analyzeMarkdownMode: ports.dependencies.analyzeMarkdownMode,
    clearAutosave: (id) => ports.getPersistence().autosaveScheduler.clear(id),
    closeDocumentSession: (...args) =>
      documentTabs.closeDocumentSession(...args),
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    fileSystem: ports.dependencies.fileSystem,
    getActiveDocumentId: () => ports.state.value.activeDocumentId,
    getActiveTabId: () => ports.state.value.activeTabId,
    getAutosaveEnabled: ports.dependencies.getAutosaveEnabled,
    getDocumentById: (...args) => ports.state.getDocumentById(...args),
    getDocuments: () => ports.state.value.documents,
    getWorkspacePath: () => ports.state.value.workspacePath,
    markSelfWritePath: (path) => {
      ports.selfWritePaths.add(path);
    },
    persistSessionStateSoon: (...args) =>
      ports.persistSessionStateSoon(...args),
    refreshWorkspaceEntries: (...args) => ports.getWorkspace().refresh(...args),
    scheduleAutosave: (id) =>
      ports.getPersistence().autosaveScheduler.schedule(id),
    syncEditorModeForActiveDocument: (...args) =>
      ports.modes.syncEditorModeForActiveDocument(...args),
    unmarkSelfWritePath: (path) => {
      ports.selfWritePaths.delete(path);
    },
    updateActiveFileWatcher: (...args) =>
      ports.updateActiveFileWatcher(...args),
    updateShellData: (...args) => ports.state.update(...args),
    window: ports.window
  });
  return { documentTabs, closing, opening, fileOperations };
}
