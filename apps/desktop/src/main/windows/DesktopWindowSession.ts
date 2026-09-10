import type { CommandRequest } from "@pluma/commands";
import { type BrowserWindow } from "electron";
import { createWindowContextCommands } from "../commands/windowContextCommands";
import { createDocumentModes } from "../documents/documentModes";
import { createWindowDocumentServices } from "../documents/windowDocumentServices";
import { SelfWriteTracking } from "../persistence/selfWriteTracking";
import { createWindowPersistenceServices } from "../persistence/windowPersistenceServices";
import { createWindowRestorationController } from "../session/windowRestorationController";
import { serializeWindowSession } from "../session/windowSessionSerialization";
import { createWindowSurfaceServices } from "../windows/windowSurfaceServices";
import type { DesktopWindowSessionDependencies } from "./windowSessionDependencies";
import { createWindowSessionNavigation } from "./windowSessionNavigation";
import { WindowSessionState } from "./windowSessionState";
import { WindowShellPublisher } from "./windowShellPublisher";
export type { DesktopWindowSessionDependencies } from "./windowSessionDependencies";

import {
  shouldProtectDocumentSessionClose,
  type DocumentSession
} from "@pluma/core";

import type { AppSettings } from "@pluma/ui/settings";
import type {
  CommandName,
  DesktopShellSnapshot,
  RendererEvent,
  WorkspaceSearchMatch
} from "../../shared/shellState";
import { type PersistedWindowSessionState } from "../persistence/appPersistence";

export class DesktopWindowSession {
  private readonly contextCommands = createWindowContextCommands({
    getSurface: () => this.windowSurfaceServices,
    getWindow: () => this.window,
    flushDocumentText: () =>
      this.dependencies.flushDocumentText?.() ?? Promise.resolve(true),
    emitToRenderer: (event) => this.emitToRenderer(event)
  });
  private readonly restoration: ReturnType<
    typeof createWindowRestorationController
  >;
  private readonly navigation: ReturnType<typeof createWindowSessionNavigation>;
  private readonly windowSurfaceServices: ReturnType<
    typeof createWindowSurfaceServices
  >;
  private readonly windowDocumentServices: ReturnType<
    typeof createWindowDocumentServices
  >;
  private readonly windowPersistenceServices: ReturnType<
    typeof createWindowPersistenceServices
  >;

  private readonly modes = createDocumentModes({
    getActiveDocument: () => this.state.getActiveDocument(),
    getDocuments: () => this.shellData.documents,
    emitToRenderer: (event) => this.emitToRenderer(event),
    emitShellSnapshot: () => this.emitShellSnapshot()
  });

  private readonly selfWriteTracking = new SelfWriteTracking();
  private get selfWritePaths() {
    return this.selfWriteTracking.paths;
  }

  private readonly state: WindowSessionState;
  private get shellData() {
    return this.state.value;
  }
  private readonly publisher = new WindowShellPublisher(
    () => this.getShellSnapshot(),
    (event) => this.emitToRenderer(event)
  );

  constructor(private readonly dependencies: DesktopWindowSessionDependencies) {
    this.state = new WindowSessionState(
      {
        activeDocumentId: null,
        activeTabId: null,
        documentViewModes: {},
        documents: [],
        editorViewMode: "source",
        isDevelopment: dependencies.isDevelopment,
        paneSizes: [],
        status: "Starting desktop shell...",
        workspaceEntries: [],
        workspacePath: null
      },
      dependencies.onMenuStateChange
    );
    this.restoration = createWindowRestorationController({
      state: this.state,
      modes: this.modes,
      getPersistence: () => this.windowPersistenceServices,
      getSurface: () => this.windowSurfaceServices,
      waitForRendererReady: () => this.dependencies.waitForRendererReady(),
      updateActiveFileWatcher: () => this.updateActiveFileWatcher(),
      updateWorkspaceWatcher: () => this.updateWorkspaceWatcher(),
      emitShellSnapshot: () => this.emitShellSnapshot()
    });
    this.navigation = createWindowSessionNavigation({
      state: this.state,
      modes: this.modes,
      getPersistence: () => this.windowPersistenceServices,
      updateActiveFileWatcher: () => this.updateActiveFileWatcher(),
      persistSessionStateSoon: () => this.persistSessionStateSoon(),
      emitShellSnapshot: () => this.emitShellSnapshot()
    });
    this.windowPersistenceServices = createWindowPersistenceServices({
      dependencies: this.dependencies,
      window: this.window,
      state: this.state,
      modes: this.modes,
      selfWritePaths: this.selfWritePaths,
      getClosing: () => this.windowDocumentServices.closing,
      getOpening: () => this.windowDocumentServices.opening,
      getDocumentTabs: () => this.windowDocumentServices.documentTabs,
      getWorkspace: () => this.windowSurfaceServices.workspace,
      emitToRenderer: (event) => this.emitToRenderer(event),
      emitShellSnapshot: () => this.emitShellSnapshot(),
      persistSessionStateSoon: () => this.persistSessionStateSoon()
    });
    this.windowDocumentServices = createWindowDocumentServices({
      dependencies: this.dependencies,
      window: this.window,
      state: this.state,
      modes: this.modes,
      selfWritePaths: this.selfWritePaths,
      getPersistence: () => this.windowPersistenceServices,
      getWorkspace: () => this.windowSurfaceServices.workspace,
      getWorkspaceActions: () => this.windowSurfaceServices.workspaceActions,
      emitToRenderer: (event) => this.emitToRenderer(event),
      emitShellSnapshot: () => this.emitShellSnapshot(),
      persistSessionStateSoon: () => this.persistSessionStateSoon(),
      getProtectedDocuments: () => this.getProtectedDocuments(),
      updateActiveFileWatcher: () => this.updateActiveFileWatcher(),
      updateWorkspaceWatcher: () => this.updateWorkspaceWatcher()
    });
    this.windowSurfaceServices = createWindowSurfaceServices({
      dependencies: this.dependencies,
      window: this.window,
      state: this.state,
      modes: this.modes,
      selfWritePaths: this.selfWritePaths,
      getPersistence: () => this.windowPersistenceServices,
      getDocuments: () => this.windowDocumentServices,
      invalidateRestoration: () => {
        this.restoration.invalidate();
      },
      emitToRenderer: (event) => this.emitToRenderer(event),
      emitStatus: (message) => this.emitStatus(message),
      emitShellSnapshot: () => this.emitShellSnapshot(),
      persistSessionStateSoon: () => this.persistSessionStateSoon(),
      getProtectedDocuments: () => this.getProtectedDocuments(),
      updateActiveFileWatcher: () => this.updateActiveFileWatcher(),
      updateWorkspaceWatcher: () => this.updateWorkspaceWatcher(),
      handleContextCommand: (...args) => this.handleContextCommand(...args)
    });
  }

  get window(): BrowserWindow {
    return this.dependencies.window;
  }

  clearAutosaveTimers(): void {
    this.windowPersistenceServices.autosaveScheduler.clearAll();
  }

  dispose(): void {
    this.restoration.dispose();
    this.windowPersistenceServices.autosaveScheduler.clearAll();
    this.windowPersistenceServices.activeFileWatcher.close();
    this.windowSurfaceServices.workspace.dispose();
  }

  emitInitialState(): void {
    this.emitToRenderer({ type: "mode-changed", mode: this.modes.currentMode });
    this.state.update({
      status:
        "Desktop shell ready. Workspace loading and document sessions are available."
    });
    this.publisher.publishInitial();
  }

  getPersistedState(): PersistedWindowSessionState {
    return serializeWindowSession(
      this.shellData,
      this.modes.currentMode,
      (doc) => this.modes.getPersistedDocumentReferenceWithMode(doc)
    );
  }

  getProtectedDocuments(): DocumentSession[] {
    return this.shellData.documents.filter(shouldProtectDocumentSessionClose);
  }

  getAuthorizedAssetRoots(): string[] {
    return this.navigation.getAuthorizedAssetRoots();
  }

  getCommandDocumentId(): string | null {
    return this.state.getActiveDocumentForActiveTab()?.id ?? null;
  }

  hasActiveDocument(): boolean {
    return this.state.getActiveDocumentForActiveTab() !== null;
  }

  async restorePersistedState(
    persistedState: PersistedWindowSessionState
  ): Promise<void> {
    return this.restoration.restorePersistedState(persistedState);
  }

  async handleOpenTarget(targetPath: string): Promise<void> {
    return this.windowDocumentServices.opening.handleOpenTarget(targetPath);
  }

  async handleCommand(command: CommandName): Promise<void> {
    return this.windowSurfaceServices.commands.handleCommand(command);
  }

  async searchWorkspace(
    query: unknown,
    folderPath: unknown,
    options: unknown
  ): Promise<WorkspaceSearchMatch[]> {
    return this.windowSurfaceServices.workspace.search(
      query,
      folderPath,
      options
    );
  }

  async refreshSettingsSensitiveState(): Promise<void> {
    await this.windowSurfaceServices.workspace.refresh();
  }

  setEditorMode(mode: unknown): void {
    return this.navigation.setEditorMode(mode);
  }

  async setActiveDocument(documentId: unknown): Promise<void> {
    return this.navigation.setActiveDocument(documentId);
  }

  async setActiveTab(tabId: unknown): Promise<void> {
    return this.navigation.setActiveTab(tabId);
  }

  async openWorkspaceFile(filePath: unknown): Promise<void> {
    return this.windowSurfaceServices.workspaceActions.openWorkspaceFile(
      filePath
    );
  }

  async closeTab(tabId: string): Promise<void> {
    return this.windowDocumentServices.closing.closeTab(tabId);
  }

  showTabContextMenu(tabId: string, tabIds: unknown): void {
    return this.contextCommands.showTabContextMenu(tabId, tabIds);
  }

  async handleContextCommand(
    request: Extract<
      CommandRequest,
      { id: `tab-${string}` | `workspace-${string}` }
    >,
    fromNativeMenu = false
  ): Promise<void> {
    return this.contextCommands.handleContextCommand(request, fromNativeMenu);
  }

  showWorkspaceContextMenu(targetPath: unknown, kind: unknown): void {
    return this.contextCommands.showWorkspaceContextMenu(targetPath, kind);
  }

  updatePaneSizes(paneSizes: unknown): void {
    return this.navigation.updatePaneSizes(paneSizes);
  }

  updateDocumentText(documentId: unknown, rawText: unknown): void {
    this.windowPersistenceServices.textEditing.updateDocumentText(
      documentId,
      rawText
    );
  }

  convertActiveDocumentLineEndings(target: "crlf" | "lf"): void {
    this.windowPersistenceServices.textEditing.convertActiveDocumentLineEndings(
      target
    );
  }

  async closeWindowWithProtection(): Promise<boolean> {
    return this.windowDocumentServices.closing.closeWindowWithProtection();
  }

  emitStatus(message: string): void {
    this.emitToRenderer({ type: "status", message });
  }

  emitSettingsChanged(settings: AppSettings): void {
    this.emitToRenderer({
      settings,
      type: "settings-changed"
    });
  }

  private emitToRenderer(event: RendererEvent): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send("pluma:event", event);
    }
  }

  private emitShellSnapshot(): void {
    this.publisher.publishChanges();
  }

  private getShellSnapshot(): DesktopShellSnapshot {
    return {
      ...this.shellData,
      documentViewModes: this.modes.getDocumentViewModesSnapshot(),
      editorViewMode: this.modes.currentMode
    };
  }

  private persistSessionStateSoon(): void {
    this.dependencies.onPersistSessionState();
  }

  private updateActiveFileWatcher(): void {
    const activeDocument = this.state.getActiveDocument();
    const activePath =
      activeDocument?.location.kind === "desktop-path"
        ? activeDocument.location.path
        : null;

    this.windowPersistenceServices.activeFileWatcher.update(activePath);
  }

  private updateWorkspaceWatcher(): void {
    this.windowSurfaceServices.workspace.updateWatcher();
  }
}
