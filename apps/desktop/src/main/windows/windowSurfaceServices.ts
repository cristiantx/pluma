import { type DocumentSession } from "@pluma/core";
import { type BrowserWindow } from "electron";
import type { RendererEvent } from "../../shared/shellState";
import { createWindowCommandHandlers } from "../commands/windowCommandHandlers";
import type { createDocumentModes } from "../documents/documentModes";
import type { createWindowDocumentServices } from "../documents/windowDocumentServices";
import { createWindowDocumentExport } from "../export/windowDocumentExport";
import { type TabMenuCommandRequest } from "../menus/tabContextMenu";
import { createWindowTabMenuOptions } from "../menus/windowTabMenuOptions";
import type { WorkspaceMenuCommandRequest } from "../menus/workspaceContextMenu";
import type { createWindowPersistenceServices } from "../persistence/windowPersistenceServices";
import { createWindowWorkspaceActions } from "../workspace/windowWorkspaceActions";
import { WindowWorkspaceCoordinator } from "../workspace/windowWorkspaceCoordinator";
import type { DesktopWindowSessionDependencies } from "./windowSessionDependencies";
import type { WindowSessionState } from "./windowSessionState";
export type WindowSurfaceServicesPorts = {
  dependencies: DesktopWindowSessionDependencies;
  window: BrowserWindow;
  state: WindowSessionState;
  modes: ReturnType<typeof createDocumentModes>;
  selfWritePaths: Set<string>;
  getPersistence(): ReturnType<typeof createWindowPersistenceServices>;
  getDocuments(): ReturnType<typeof createWindowDocumentServices>;
  invalidateRestoration(): void;
  emitToRenderer(event: RendererEvent): void;
  emitStatus(message: string): void;
  emitShellSnapshot(): void;
  persistSessionStateSoon(): void;
  getProtectedDocuments(): DocumentSession[];
  updateActiveFileWatcher(): void;
  updateWorkspaceWatcher(): void;
  handleContextCommand(
    request: TabMenuCommandRequest | WorkspaceMenuCommandRequest,
    fromNativeMenu?: boolean
  ): Promise<void>;
};
export function createWindowSurfaceServices(ports: WindowSurfaceServicesPorts) {
  const documentExport = createWindowDocumentExport({
    getActiveDocumentForActiveTab: () =>
      ports.state.getActiveDocumentForActiveTab(),
    emitToRenderer: (event) => ports.emitToRenderer(event),
    window: ports.window,
    appDocumentsPath: ports.dependencies.appDocumentsPath,
    getOpenExportedFile: ports.dependencies.getOpenExportedFile
  });
  const commands = createWindowCommandHandlers({
    closeActiveDocumentSession: (...args) =>
      ports.getDocuments().closing.closeActiveDocumentSession(...args),
    createNewMarkdownFile: (...args) =>
      ports.getDocuments().opening.createNewMarkdownFile(...args),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    exportActiveDocument: (...args) =>
      documentExport.exportActiveDocument(...args),
    getNextEditorMode: (...args) => ports.modes.getNextEditorMode(...args),
    isDevelopment: ports.dependencies.isDevelopment,
    keepEditingActiveDocument: (...args) =>
      ports.getPersistence().reload.keepEditingActiveDocument(...args),
    openDevTools: () =>
      ports.window.webContents.openDevTools({ mode: "detach" }),
    openFileFromDialog: (...args) =>
      ports.getDocuments().opening.openFileFromDialog(...args),
    openFolderFromDialog: (...args) =>
      workspaceActions.openFolderFromDialog(...args),
    persistSessionStateSoon: (...args) =>
      ports.persistSessionStateSoon(...args),
    reloadActiveDocumentFromDisk: (...args) =>
      ports.getPersistence().reload.reloadActiveDocumentFromDisk(...args),
    saveActiveDocument: (...args) =>
      ports.getPersistence().saving.saveActiveDocument(...args),
    saveActiveDocumentAs: (...args) =>
      ports.getPersistence().saving.saveActiveDocumentAs(...args),
    setActiveTab: (activeTabId) => ports.state.update({ activeTabId }),
    setModeForActiveDocument: (...args) =>
      ports.modes.setModeForActiveDocument(...args)
  });
  const tabMenus = createWindowTabMenuOptions({
    closeDocumentsAndMaybeSettings: (...args) =>
      ports.getDocuments().closing.closeDocumentsAndMaybeSettings(...args),
    closeDocumentsWithProtection: (...args) =>
      ports.getDocuments().closing.closeDocumentsWithProtection(...args),
    copyDocumentPath: (id) =>
      workspaceActions.getWorkspaceFileActions().copyDocumentPath(id),
    emitCloseSettingsTab: (...args) =>
      ports.getDocuments().closing.emitCloseSettingsTab(...args),
    emitStatus: (...args) => ports.emitStatus(...args),
    getDocumentById: (...args) => ports.state.getDocumentById(...args),
    getDocuments: () => ports.state.value.documents,
    getWorkspacePath: () => ports.state.value.workspacePath,
    handleContextCommand: (...args) => ports.handleContextCommand(...args),
    renameDocument: (...args) =>
      ports.getDocuments().fileOperations.renameDocument(...args),
    revealDocumentInWorkspace: (...args) =>
      ports.getDocuments().fileOperations.revealDocumentInWorkspace(...args),
    showDocumentInFolder: (id) =>
      workspaceActions.getWorkspaceFileActions().showDocumentInFolder(id)
  });
  const workspaceActions = createWindowWorkspaceActions({
    invalidateRestoration: () => {
      ports.invalidateRestoration();
    },
    getShellData: () => ports.state.value,
    getWindow: () => ports.window,
    fileSystem: ports.dependencies.fileSystem,
    getDefaultLineEnding: () => ports.dependencies.getDefaultLineEnding(),
    selfWritePaths: ports.selfWritePaths,
    clearAutosave: () => ports.getPersistence().autosaveScheduler.clearAll(),
    emitToRenderer: (...args) => ports.emitToRenderer(...args),
    emitStatus: (...args) => ports.emitStatus(...args),
    emitShellSnapshot: (...args) => ports.emitShellSnapshot(...args),
    getProtectedDocuments: (...args) => ports.getProtectedDocuments(...args),
    resolveProtectedDocumentClose: (...args) =>
      ports.getDocuments().closing.resolveProtectedDocumentClose(...args),
    closeDocumentSessions: (...args) =>
      ports.getDocuments().documentTabs.closeDocumentSessions(...args),
    updateShellData: (...args) => ports.state.update(...args),
    syncEditorModeForActiveDocument: (...args) =>
      ports.modes.syncEditorModeForActiveDocument(...args),
    updateActiveFileWatcher: (...args) =>
      ports.updateActiveFileWatcher(...args),
    updateWorkspaceWatcher: (...args) => ports.updateWorkspaceWatcher(...args),
    persistSessionStateSoon: (...args) =>
      ports.persistSessionStateSoon(...args),
    refreshWorkspaceEntries: (...args) => workspace.refresh(...args),
    confirmDiscardDocumentsSequentially: (...args) =>
      ports.getDocuments().closing.confirmDiscardDocumentsSequentially(...args),
    openFilePath: (...args) =>
      ports.getDocuments().opening.openFilePath(...args),
    handleContextCommand: (...args) => ports.handleContextCommand(...args)
  });
  const workspace = new WindowWorkspaceCoordinator({
    emitStatus: (message) => ports.emitStatus(message),
    fileSystem: ports.dependencies.fileSystem,
    getRespectGitIgnore: ports.dependencies.getWorkspaceRespectGitIgnore,
    getShowHiddenFiles: ports.dependencies.getWorkspaceShowHiddenFiles,
    getWorkspacePath: () => ports.state.value.workspacePath,
    publishEntries: (workspaceEntries) => {
      ports.state.update({ workspaceEntries });
      ports.emitShellSnapshot();
    }
  });
  return { workspace, workspaceActions, documentExport, commands, tabMenus };
}
