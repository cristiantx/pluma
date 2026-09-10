import type { CommandRequest } from "@pluma/commands";
import { dialog, shell, type BrowserWindow } from "electron";
import path from "node:path";
import { createDocumentClosing } from "../documents/documentClosing";
import { createDocumentFileOperations } from "../documents/documentFileOperations";
import { createDocumentModes } from "../documents/documentModes";
import { createDocumentOpening } from "../documents/documentOpening";
import { createDocumentTabs } from "../documents/documentTabs";
import { WindowSessionState } from "./windowSessionState";
import { WindowShellPublisher } from "./windowShellPublisher";

import {
  applyLineEnding,
  createDocumentSession,
  isMarkdownFilePath,
  markDocumentSessionConflict,
  markDocumentSessionExternalChange,
  markDocumentSessionSaveError,
  markDocumentSessionSaving,
  resolveDefaultLineEnding,
  shouldProtectDocumentSessionClose,
  updateDocumentSessionText,
  type AppDraftFileLocation,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import type { AppSettings } from "@pluma/ui/settings";
import type {
  CommandName,
  DesktopShellSnapshot,
  EditorViewMode,
  RendererEvent,
  WorkspaceSearchMatch,
  WorkspaceSearchOptions
} from "../../shared/shellState";
import { AutosaveScheduler } from "../autosave/autosaveScheduler";
import {
  exportDocument,
  type ExportDocumentResult
} from "../export/desktopExport";
import type { ExportDocumentFormat } from "../export/exportDocumentHtml";
import {
  buildTabContextMenu,
  executeTabMenuCommand,
  type TabContextMenuOptions,
  type TabMenuCommandRequest
} from "../menus/tabContextMenu";
import type { WorkspaceMenuCommandRequest } from "../menus/workspaceContextMenu";
import type { AppDraftStorage } from "../persistence/appDraftStorage";
import {
  isEditorViewMode,
  type PersistedDocumentReference,
  type PersistedWindowSessionState
} from "../persistence/appPersistence";
import { DocumentSaveQueue } from "../persistence/documentSaveQueue";
import { mapWithConcurrency } from "../runtime/asyncConcurrency";
import { ActiveFileWatcher } from "../watching/activeFileWatcher";
import { WorkspaceWatcher } from "../watching/workspaceWatcher";
import {
  createSessionForFilePath,
  isPathInsideDirectory,
  tryCollectWorkspaceEntries,
  tryCreateSessionForFilePath,
  type MarkdownModeAnalyzer
} from "../workspace/desktopWorkspace";
import {
  createWorkspaceFileActions,
  type WorkspaceFileActions
} from "../workspace/workspaceFileActions";
import { WorkspaceSearchController } from "../workspace/workspaceSearch";
import { markDocumentAfterSuccessfulWrite } from "./documentSaveState";

const restoredDocumentConcurrency = 2;

export type DesktopWindowSessionDependencies = {
  analyzeMarkdownMode: MarkdownModeAnalyzer;
  appDocumentsPath: string;
  autosaveDelayMs: number;
  draftStorage: AppDraftStorage;
  flushDocumentText?: () => Promise<boolean>;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getAutosaveEnabled: () => boolean;
  getDefaultLineEnding: () => "crlf" | "lf" | "system";
  getOpenExportedFile: () => boolean;
  getWorkspaceRespectGitIgnore: () => boolean;
  getWorkspaceShowHiddenFiles: () => boolean;
  isDevelopment: boolean;
  onMenuStateChange: () => void;
  onPersistSessionState: () => void;
  waitForRendererReady: () => Promise<void>;
  window: BrowserWindow;
};

export class DesktopWindowSession {
  private readonly documentTabs = createDocumentTabs({
    getShellData: () => this.shellData,
    updateShellData: (value) => this.updateShellData(value),
    syncEditorModeForActiveDocument: () =>
      this.syncEditorModeForActiveDocument(),
    updateActiveFileWatcher: () => this.updateActiveFileWatcher(),
    getDocumentById: (id) => this.getDocumentById(id),
    deleteDraftSoon: (document) => this.deleteDraftSoon(document),
    clearAutosave: (id) => this.autosaveScheduler.clear(id)
  });
  private readonly fileOperations: ReturnType<
    typeof createDocumentFileOperations
  >;
  private readonly opening: ReturnType<typeof createDocumentOpening>;
  private readonly closing: ReturnType<typeof createDocumentClosing>;
  private readonly modes = createDocumentModes({
    getActiveDocument: () => this.getActiveDocument(),
    getDocuments: () => this.shellData.documents,
    emitToRenderer: (event) => this.emitToRenderer(event),
    emitShellSnapshot: () => this.emitShellSnapshot()
  });
  private readonly activeFileWatcher: ActiveFileWatcher;
  private readonly autosaveScheduler: AutosaveScheduler;
  private get documentModes() {
    return this.modes.documentModes;
  }

  private readonly saveQueue = new DocumentSaveQueue();
  private readonly selfWritePaths = new Set<string>();
  private readonly workspaceWatcher: WorkspaceWatcher;
  private readonly workspaceSearchController = new WorkspaceSearchController();
  private get currentMode() {
    return this.modes.currentMode;
  }
  private set currentMode(mode: EditorViewMode) {
    this.modes.currentMode = mode;
  }
  private readonly state: WindowSessionState;
  private get shellData() {
    return this.state.value;
  }
  private readonly publisher = new WindowShellPublisher(
    () => this.getShellSnapshot(),
    (event) => this.emitToRenderer(event)
  );
  private workspaceFileActions: WorkspaceFileActions | null = null;
  private workspaceRefreshPromise: Promise<void> | null = null;
  private workspaceRefreshVersion = 0;

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

    this.closing = createDocumentClosing({
      window: this.window,
      getActiveDocumentForActiveTab: (...args) =>
        this.getActiveDocumentForActiveTab(...args),
      getDocumentById: (...args) => this.getDocumentById(...args),
      getProtectedDocuments: (...args) => this.getProtectedDocuments(...args),
      getCurrentDocumentIdForClose: (...args) =>
        this.getCurrentDocumentIdForClose(...args),
      closeDocumentSession: (...args) => this.closeDocumentSession(...args),
      closeDocumentSessionsWithOptions: (...args) =>
        this.closeDocumentSessionsWithOptions(...args),
      saveDocument: (...args) => this.saveDocument(...args),
      emitToRenderer: (...args) => this.emitToRenderer(...args),
      emitShellSnapshot: (...args) => this.emitShellSnapshot(...args),
      persistSessionStateSoon: (...args) =>
        this.persistSessionStateSoon(...args)
    });
    this.opening = createDocumentOpening({
      analyzeMarkdownMode: this.dependencies.analyzeMarkdownMode,
      appDocumentsPath: this.dependencies.appDocumentsPath,
      draftStorage: this.dependencies.draftStorage,
      emitShellSnapshot: (...args) => this.emitShellSnapshot(...args),
      emitToRenderer: (...args) => this.emitToRenderer(...args),
      fileSystem: this.dependencies.fileSystem,
      getCurrentMode: () => this.currentMode,
      getDefaultLineEnding: this.dependencies.getDefaultLineEnding,
      getDocumentByDesktopPath: (...args) =>
        this.getDocumentByDesktopPath(...args),
      getDocuments: () => this.shellData.documents,
      getWorkspaceEntries: () => this.shellData.workspaceEntries,
      getWorkspacePath: () => this.shellData.workspacePath,
      mergeDocumentSession: (...args) => this.mergeDocumentSession(...args),
      openFolderPath: (...args) => this.openFolderPath(...args),
      persistSessionStateSoon: (...args) =>
        this.persistSessionStateSoon(...args),
      syncEditorModeForActiveDocument: (...args) =>
        this.syncEditorModeForActiveDocument(...args),
      updateActiveFileWatcher: (...args) =>
        this.updateActiveFileWatcher(...args),
      updateShellData: (...args) => this.updateShellData(...args),
      updateWorkspaceWatcher: (...args) => this.updateWorkspaceWatcher(...args),
      window: this.window
    });
    this.fileOperations = createDocumentFileOperations({
      analyzeMarkdownMode: this.dependencies.analyzeMarkdownMode,
      clearAutosave: (id) => this.autosaveScheduler.clear(id),
      closeDocumentSession: (...args) => this.closeDocumentSession(...args),
      emitShellSnapshot: (...args) => this.emitShellSnapshot(...args),
      emitToRenderer: (...args) => this.emitToRenderer(...args),
      fileSystem: this.dependencies.fileSystem,
      getActiveDocumentId: () => this.shellData.activeDocumentId,
      getActiveTabId: () => this.shellData.activeTabId,
      getAutosaveEnabled: this.dependencies.getAutosaveEnabled,
      getDocumentById: (...args) => this.getDocumentById(...args),
      getDocuments: () => this.shellData.documents,
      getWorkspacePath: () => this.shellData.workspacePath,
      markSelfWritePath: (path) => {
        this.selfWritePaths.add(path);
      },
      persistSessionStateSoon: (...args) =>
        this.persistSessionStateSoon(...args),
      refreshWorkspaceEntries: (...args) =>
        this.refreshWorkspaceEntries(...args),
      scheduleAutosave: (id) => this.autosaveScheduler.schedule(id),
      syncEditorModeForActiveDocument: (...args) =>
        this.syncEditorModeForActiveDocument(...args),
      unmarkSelfWritePath: (path) => {
        this.selfWritePaths.delete(path);
      },
      updateActiveFileWatcher: (...args) =>
        this.updateActiveFileWatcher(...args),
      updateShellData: (...args) => this.updateShellData(...args),
      window: this.window
    });
    this.autosaveScheduler = new AutosaveScheduler(
      dependencies.autosaveDelayMs,
      (documentId) => {
        void this.saveDocument(documentId, "autosave");
      }
    );
    this.activeFileWatcher = new ActiveFileWatcher(
      (filePath) => {
        void this.handleActiveFileExternalChange(filePath);
      },
      (message) => this.emitToRenderer({ type: "status", message })
    );
    this.workspaceWatcher = new WorkspaceWatcher(
      () => {
        void this.refreshWorkspaceEntries();
      },
      (message) => this.emitToRenderer({ type: "status", message })
    );
  }

  get window(): BrowserWindow {
    return this.dependencies.window;
  }

  clearAutosaveTimers(): void {
    this.autosaveScheduler.clearAll();
  }

  dispose(): void {
    this.autosaveScheduler.clearAll();
    this.activeFileWatcher.close();
    this.workspaceWatcher.close();
    this.workspaceSearchController.dispose();
  }

  emitInitialState(): void {
    this.emitToRenderer({ type: "mode-changed", mode: this.currentMode });
    this.updateShellData({
      status:
        "Desktop shell ready. Workspace loading and document sessions are available."
    });
    this.publisher.publishInitial();
  }

  getPersistedState(): PersistedWindowSessionState {
    const activeDocument = this.getActiveDocument();
    const activeDocumentRef = activeDocument
      ? this.getPersistedDocumentReferenceWithMode(activeDocument)
      : null;

    return {
      activeDocumentRef,
      activeDocumentPath: this.getDocumentPath(this.shellData.activeDocumentId),
      documentRefs: this.shellData.documents.flatMap((document) => {
        const documentRef =
          this.getPersistedDocumentReferenceWithMode(document);

        return documentRef ? [documentRef] : [];
      }),
      documentPaths: this.shellData.documents.flatMap((document) =>
        document.location.kind === "desktop-path"
          ? [document.location.path]
          : []
      ),
      editorMode: this.currentMode,
      paneSizes: this.shellData.paneSizes,
      workspacePath: this.shellData.workspacePath
    };
  }

  getProtectedDocuments(): DocumentSession[] {
    return this.shellData.documents.filter(shouldProtectDocumentSessionClose);
  }

  getAuthorizedAssetRoots(): string[] {
    const roots = new Set<string>();

    if (this.shellData.workspacePath) {
      roots.add(this.shellData.workspacePath);
    }

    for (const document of this.shellData.documents) {
      if (
        document.location.kind === "desktop-path" &&
        (!this.shellData.workspacePath ||
          !isPathInsideDirectory(
            this.shellData.workspacePath,
            document.location.path
          ))
      ) {
        roots.add(path.dirname(document.location.path));
      }
    }

    return [...roots];
  }

  getCommandDocumentId(): string | null {
    return this.getActiveDocumentForActiveTab()?.id ?? null;
  }

  hasActiveDocument(): boolean {
    return this.getActiveDocumentForActiveTab() !== null;
  }

  async restorePersistedState(
    persistedState: PersistedWindowSessionState
  ): Promise<void> {
    this.currentMode = persistedState.editorMode;
    this.documentModes.clear();
    const documentRefs: PersistedDocumentReference[] =
      persistedState.documentRefs ??
      persistedState.documentPaths.map((documentPath) => ({
        kind: "desktop-path" as const,
        path: documentPath
      }));
    const prioritizedRefs = prioritizeActiveDocumentRef(
      documentRefs,
      persistedState
    );
    const attemptedKeys = new Set<string>();
    const loadedDocuments = new Map<string, DocumentSession>();
    let activeDocument: DocumentSession | null = null;

    for (const documentRef of prioritizedRefs) {
      const key = createDocumentModeKeyFromPersistedReference(documentRef);
      attemptedKeys.add(key);
      const document =
        await this.createSessionForPersistedDocumentRef(documentRef);

      if (document) {
        activeDocument = document;
        loadedDocuments.set(key, document);
        this.setStoredDocumentMode(
          document,
          documentRef.editorMode ?? persistedState.editorMode
        );
        break;
      }
    }

    this.updateShellData({
      activeDocumentId: activeDocument?.id ?? null,
      activeTabId: activeDocument?.id ?? null,
      documents: activeDocument ? [activeDocument] : [],
      paneSizes: persistedState.paneSizes ?? [],
      status:
        activeDocument || persistedState.workspacePath
          ? "Restored previous session."
          : "Desktop shell ready.",
      workspaceEntries: [],
      workspacePath: persistedState.workspacePath
    });
    this.syncEditorModeForActiveDocument({ emit: false });
    this.updateActiveFileWatcher();
    this.updateWorkspaceWatcher();
    this.emitShellSnapshot();
    await this.dependencies.waitForRendererReady();

    const remainingRefs = documentRefs.filter(
      (documentRef) =>
        !attemptedKeys.has(
          createDocumentModeKeyFromPersistedReference(documentRef)
        )
    );
    const restoreDocuments = mapWithConcurrency(
      remainingRefs,
      restoredDocumentConcurrency,
      async (documentRef) => {
        const document =
          await this.createSessionForPersistedDocumentRef(documentRef);

        if (!document) {
          return;
        }

        loadedDocuments.set(
          createDocumentModeKeyFromPersistedReference(documentRef),
          document
        );
        this.setStoredDocumentMode(
          document,
          documentRef.editorMode ?? persistedState.editorMode
        );
        this.updateShellData({
          documents: getLoadedDocumentsInPersistedOrder(
            documentRefs,
            loadedDocuments
          )
        });
        this.emitShellSnapshot();
      }
    );
    const restoreWorkspace = this.refreshWorkspaceEntries();

    await Promise.all([restoreDocuments, restoreWorkspace]);
  }

  async handleOpenTarget(targetPath: string): Promise<void> {
    return this.opening.handleOpenTarget(targetPath);
  }

  async handleCommand(command: CommandName): Promise<void> {
    switch (command) {
      case "close-active-tab":
        await this.closeActiveDocumentSession();
        return;
      case "find":
      case "find-next":
      case "find-previous":
      case "replace":
        this.emitToRenderer({ type: "editor-command", command });
        return;
      case "export-html":
        await this.exportActiveDocument("html");
        return;
      case "export-pdf":
        await this.exportActiveDocument("pdf");
        return;
      case "keep-editing":
        await this.keepEditingActiveDocument();
        return;
      case "new-file":
        await this.createNewMarkdownFile();
        return;
      case "new-window":
      case "reload-window":
      case "force-reload-window":
        return;
      case "open-file":
        await this.openFileFromDialog();
        return;
      case "open-folder":
        await this.openFolderFromDialog();
        return;
      case "open-settings":
        this.updateShellData({ activeTabId: "settings" });
        this.emitToRenderer({ type: "open-settings" });
        return;
      case "reload-from-disk":
        await this.reloadActiveDocumentFromDisk();
        return;
      case "save":
        await this.saveActiveDocument();
        return;
      case "save-as":
        await this.saveActiveDocumentAs();
        return;
      case "toggle-mode":
        this.setModeForActiveDocument(this.getNextEditorMode());
        this.persistSessionStateSoon();
        return;
      case "open-devtools":
        if (this.dependencies.isDevelopment) {
          this.window.webContents.openDevTools({ mode: "detach" });
        }
        return;
    }
  }

  async searchWorkspace(
    query: unknown,
    folderPath: unknown,
    options: unknown
  ): Promise<WorkspaceSearchMatch[]> {
    if (
      typeof query !== "string" ||
      !this.shellData.workspacePath ||
      !isWorkspaceSearchOptions(options)
    ) {
      return [];
    }

    return this.workspaceSearchController.search({
      folderPath: typeof folderPath === "string" ? folderPath : null,
      options: {
        ...options,
        respectGitIgnore: this.dependencies.getWorkspaceRespectGitIgnore()
      },
      query,
      workspacePath: this.shellData.workspacePath
    });
  }

  async refreshSettingsSensitiveState(): Promise<void> {
    await this.refreshWorkspaceEntries();
  }

  setEditorMode(mode: unknown): void {
    if (!isEditorViewMode(mode)) {
      return;
    }

    this.setModeForActiveDocument(mode);
    this.persistSessionStateSoon();
  }

  async setActiveDocument(documentId: unknown): Promise<void> {
    if (
      typeof documentId !== "string" ||
      !this.shellData.documents.some((document) => document.id === documentId)
    ) {
      return;
    }

    this.updateShellData({
      activeDocumentId: documentId,
      activeTabId: documentId
    });
    this.syncEditorModeForActiveDocument();
    this.updateActiveFileWatcher();
    await this.reconcileDocumentWithDisk(documentId, { emitSnapshot: false });
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  async setActiveTab(tabId: unknown): Promise<void> {
    if (tabId === "settings") {
      this.updateShellData({ activeTabId: "settings" });
      this.emitShellSnapshot();
      return;
    }

    await this.setActiveDocument(tabId);
  }

  async openWorkspaceFile(filePath: unknown): Promise<void> {
    if (
      typeof filePath !== "string" ||
      !this.shellData.workspacePath ||
      !isMarkdownFilePath(filePath) ||
      !isPathInsideDirectory(this.shellData.workspacePath, filePath)
    ) {
      this.emitToRenderer({
        type: "status",
        message: "Workspace file open was ignored."
      });
      return;
    }

    await this.openFilePath(filePath, {
      workspacePath: this.shellData.workspacePath
    });
  }

  async closeTab(tabId: string): Promise<void> {
    return this.closing.closeTab(tabId);
  }

  showTabContextMenu(tabId: string, tabIds: unknown): void {
    const options = this.getTabContextMenuOptions(tabId, tabIds);
    if (options) buildTabContextMenu(options).popup({ window: this.window });
  }

  async handleContextCommand(
    request: Extract<
      CommandRequest,
      { id: `tab-${string}` | `workspace-${string}` }
    >,
    fromNativeMenu = false
  ): Promise<void> {
    if (
      fromNativeMenu &&
      this.dependencies.flushDocumentText &&
      !(await this.dependencies.flushDocumentText())
    )
      return;
    if (this.window.isDestroyed()) return;
    if (request.id.startsWith("tab-")) {
      const tabRequest = request as TabMenuCommandRequest;
      const options = this.getTabContextMenuOptions(
        tabRequest.args.tabId,
        tabRequest.args.tabIds
      );
      if (options) await executeTabMenuCommand(tabRequest, options);
      return;
    }
    const workspaceRequest = request as WorkspaceMenuCommandRequest;
    if (
      !this.isValidWorkspaceTarget(
        workspaceRequest.args.path,
        workspaceRequest.args.kind
      )
    )
      return;
    await this.getWorkspaceFileActions().executeCommand(workspaceRequest);
  }

  private getTabContextMenuOptions(
    tabId: string,
    tabIds: unknown
  ): TabContextMenuOptions | null {
    const openTabIds = Array.isArray(tabIds)
      ? tabIds.filter((candidate) => typeof candidate === "string")
      : [];
    const hasSettingsTab = openTabIds.includes("settings");

    if (tabId === "settings") {
      return this.getSettingsTabContextMenuOptions(openTabIds);
    }

    const documentId = tabId;
    const document = this.getDocumentById(documentId);

    if (!document) {
      return null;
    }

    const otherDocuments = this.shellData.documents.filter(
      (candidate) => candidate.id !== document.id
    );
    const savedDocuments = this.shellData.documents.filter(
      (candidate) => candidate.saveState === "idle"
    );
    const hasDesktopPath = document.location.kind === "desktop-path";
    const canRevealInWorkspace =
      this.shellData.workspacePath !== null &&
      document.location.kind === "desktop-path" &&
      isPathInsideDirectory(
        this.shellData.workspacePath,
        document.location.path
      );
    return {
      target: { tabId, tabIds: openTabIds },
      onCommand: (request) => {
        void this.handleContextCommand(request, true).catch((error: unknown) =>
          this.emitStatus(String(error))
        );
      },
      canCloseAll: this.shellData.documents.length > 0 || hasSettingsTab,
      canCloseOthers: otherDocuments.length > 0 || hasSettingsTab,
      canCloseSavedTabs: savedDocuments.length > 0,
      canCopyPath: hasDesktopPath,
      canRename: hasDesktopPath,
      canRevealInWorkspace,
      canShowInFolder: hasDesktopPath,
      onClose: () =>
        this.closeDocumentsWithProtection([document], "Closed document tab."),
      onCloseOthers: () =>
        this.closeDocumentsAndMaybeSettings(
          otherDocuments,
          hasSettingsTab,
          "Closed other tabs."
        ),
      onCloseSavedTabs: () =>
        this.closeDocumentsWithProtection(
          savedDocuments,
          "Closed saved document tabs."
        ),
      onCloseAll: () =>
        this.closeDocumentsAndMaybeSettings(
          this.shellData.documents,
          hasSettingsTab,
          "Closed all tabs."
        ),
      onRename: () => this.renameDocument(document.id),
      onCopyPath: () =>
        this.getWorkspaceFileActions().copyDocumentPath(document.id),
      onShowInFolder: () =>
        this.getWorkspaceFileActions().showDocumentInFolder(document.id),
      onRevealInWorkspace: () => this.revealDocumentInWorkspace(document)
    };
  }

  private getSettingsTabContextMenuOptions(
    openTabIds: string[]
  ): TabContextMenuOptions {
    const savedDocuments = this.shellData.documents.filter(
      (candidate) => candidate.saveState === "idle"
    );
    return {
      target: { tabId: "settings", tabIds: openTabIds },
      onCommand: (request) => {
        void this.handleContextCommand(request, true).catch((error: unknown) =>
          this.emitStatus(String(error))
        );
      },
      canCloseAll: openTabIds.length > 0,
      canCloseOthers: this.shellData.documents.length > 0,
      canCloseSavedTabs: savedDocuments.length > 0,
      canCopyPath: false,
      canRename: false,
      canRevealInWorkspace: false,
      canShowInFolder: false,
      includeFileActions: false,
      onClose: () => this.emitCloseSettingsTab(),
      onCloseOthers: () =>
        this.closeDocumentsWithProtection(
          this.shellData.documents,
          "Closed other document tabs."
        ),
      onCloseSavedTabs: () =>
        this.closeDocumentsWithProtection(
          savedDocuments,
          "Closed saved document tabs."
        ),
      onCloseAll: () =>
        this.closeDocumentsAndMaybeSettings(
          this.shellData.documents,
          true,
          "Closed all tabs."
        ),
      onCopyPath: () => undefined,
      onRename: () => undefined,
      onRevealInWorkspace: () => undefined,
      onShowInFolder: () => undefined
    };
  }

  showWorkspaceContextMenu(targetPath: unknown, kind: unknown): void {
    if (
      typeof targetPath !== "string" ||
      (kind !== "file" && kind !== "folder") ||
      !this.isValidWorkspaceTarget(targetPath, kind)
    ) {
      this.emitToRenderer({
        type: "status",
        message: "Workspace action was ignored."
      });
      return;
    }

    this.getWorkspaceFileActions().showWorkspaceContextMenu(targetPath, kind);
  }

  updatePaneSizes(paneSizes: unknown): void {
    if (
      !Array.isArray(paneSizes) ||
      !paneSizes.every((paneSize) => typeof paneSize === "number")
    ) {
      return;
    }

    this.updateShellData({ paneSizes });
    this.persistSessionStateSoon();
  }

  updateDocumentText(documentId: unknown, rawText: unknown): void {
    if (typeof documentId !== "string" || typeof rawText !== "string") {
      return;
    }

    const activeDocument = this.shellData.documents.find(
      (document) => document.id === documentId
    );

    if (!activeDocument || activeDocument.rawText === rawText) {
      return;
    }

    const nextDocument = updateDocumentSessionText(activeDocument, rawText);
    const nextDocuments = this.shellData.documents.map((document) =>
      document.id === documentId ? nextDocument : document
    );

    this.updateShellData({
      documents: nextDocuments,
      status: "Document edited."
    });

    if (nextDocument.saveState === "dirty") {
      if (
        nextDocument.location.kind === "app-draft" ||
        this.dependencies.getAutosaveEnabled()
      ) {
        this.autosaveScheduler.schedule(documentId);
      } else {
        this.autosaveScheduler.clear(documentId);
      }
    } else {
      this.autosaveScheduler.clear(documentId);
    }
  }

  convertActiveDocumentLineEndings(target: "crlf" | "lf"): void {
    const activeDocument = this.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      this.emitToRenderer({
        type: "status",
        message: "No active document to convert."
      });
      return;
    }

    const convertedText = applyLineEnding(activeDocument.rawText, target);
    const nextDocument: DocumentSession = {
      ...activeDocument,
      lineEnding: target,
      rawText: convertedText,
      saveState:
        convertedText === activeDocument.lastSavedText ? "idle" : "dirty"
    };

    if (
      nextDocument.rawText === activeDocument.rawText &&
      nextDocument.lineEnding === activeDocument.lineEnding
    ) {
      this.updateShellData({
        status: `Line endings already ${target.toUpperCase()}.`
      });
      this.emitShellSnapshot();
      return;
    }

    this.updateShellData({
      documents: this.shellData.documents.map((document) =>
        document.id === activeDocument.id ? nextDocument : document
      ),
      status: `Converted line endings to ${target.toUpperCase()}.`
    });

    if (
      this.dependencies.getAutosaveEnabled() &&
      nextDocument.saveState === "dirty"
    ) {
      this.autosaveScheduler.schedule(nextDocument.id);
    }

    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  async closeWindowWithProtection(): Promise<boolean> {
    return this.closing.closeWindowWithProtection();
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
      documentViewModes: this.getDocumentViewModesSnapshot(),
      editorViewMode: this.currentMode
    };
  }

  private updateShellData(
    update: Partial<DesktopShellSnapshot>
  ): DesktopShellSnapshot {
    return this.state.update(update);
  }

  private getDocumentPath(documentId: string | null): string | null {
    return this.state.getDocumentPath(documentId);
  }

  private getActiveDocument(): DocumentSession | null {
    return this.state.getActiveDocument();
  }

  private getActiveDocumentForActiveTab(): DocumentSession | null {
    return this.state.getActiveDocumentForActiveTab();
  }

  private getAllowedEditorMode(
    document: DocumentSession | null,
    mode: EditorViewMode
  ): EditorViewMode {
    return this.modes.getAllowedEditorMode(document, mode);
  }

  private getNextEditorMode(): EditorViewMode {
    return this.modes.getNextEditorMode();
  }

  private getStoredDocumentMode(
    document: DocumentSession | null
  ): EditorViewMode {
    return this.modes.getStoredDocumentMode(document);
  }

  private getDefaultDocumentMode(document: DocumentSession): EditorViewMode {
    return this.modes.getDefaultDocumentMode(document);
  }

  private getDocumentModeKey(document: DocumentSession): string {
    return this.modes.getDocumentModeKey(document);
  }

  private setStoredDocumentMode(
    document: DocumentSession,
    mode: EditorViewMode
  ): void {
    return this.modes.setStoredDocumentMode(document, mode);
  }

  private getDocumentViewModesSnapshot(): Record<string, EditorViewMode> {
    return this.modes.getDocumentViewModesSnapshot();
  }

  private getPersistedDocumentReferenceWithMode(
    document: DocumentSession
  ): PersistedDocumentReference | null {
    return this.modes.getPersistedDocumentReferenceWithMode(document);
  }

  private setModeForActiveDocument(mode: EditorViewMode): void {
    return this.modes.setModeForActiveDocument(mode);
  }

  private syncEditorModeForActiveDocument(
    options: { emit?: boolean } = {}
  ): void {
    return this.modes.syncEditorModeForActiveDocument(options);
  }

  private getDefaultNewFilePath(): string {
    return this.opening.getDefaultNewFilePath();
  }

  private getDefaultSaveAsPath(document: DocumentSession): string {
    return this.opening.getDefaultSaveAsPath(document);
  }

  private async exportActiveDocument(
    format: ExportDocumentFormat
  ): Promise<void> {
    const activeDocument = this.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      this.emitToRenderer({
        type: "status",
        message: "No active document to export."
      });
      return;
    }

    try {
      const result = await exportDocument({
        appDocumentsPath: this.dependencies.appDocumentsPath,
        document: activeDocument,
        format,
        parentWindow: this.window
      });

      await this.handleExportResult(result, format);
    } catch (error) {
      this.emitToRenderer({
        type: "status",
        message:
          error instanceof Error
            ? `Export failed: ${error.message}`
            : "Export failed."
      });
    }
  }

  private async handleExportResult(
    result: ExportDocumentResult,
    format: ExportDocumentFormat
  ): Promise<void> {
    if (result.kind === "cancelled") {
      this.emitToRenderer({ type: "status", message: "Export cancelled." });
      return;
    }

    if (this.dependencies.getOpenExportedFile()) {
      await shell.openPath(result.filePath);
    }

    this.emitToRenderer({
      type: "status",
      message:
        format === "html"
          ? `Exported HTML to ${path.basename(result.filePath)}.`
          : `Exported PDF to ${path.basename(result.filePath)}.`
    });
  }

  private getNextDraftName(): string {
    return this.opening.getNextDraftName();
  }

  private async createSessionForPersistedDocumentRef(
    documentRef: PersistedDocumentReference
  ): Promise<DocumentSession | null> {
    if (documentRef.kind === "desktop-path") {
      return tryCreateSessionForFilePath(
        this.dependencies.fileSystem,
        documentRef.path,
        this.dependencies.analyzeMarkdownMode
      );
    }

    const location: AppDraftFileLocation = {
      draftId: documentRef.draftId,
      kind: "app-draft",
      name: documentRef.name
    };
    const rawText = await this.dependencies.draftStorage.readDraft(location);

    if (rawText === null) {
      return null;
    }

    const modeConstraint = await this.dependencies.analyzeMarkdownMode(rawText);

    return createDocumentSession({
      location,
      metadata: null,
      mode: modeConstraint === "source-only" ? "source" : "rich",
      modeConstraint,
      rawText
    });
  }

  private persistSessionStateSoon(): void {
    this.dependencies.onPersistSessionState();
  }

  private mergeDocumentSession(nextSession: DocumentSession): void {
    return this.documentTabs.mergeDocumentSession(nextSession);
  }

  private replaceDocumentSession(
    documentId: string,
    nextSession: DocumentSession
  ): void {
    return this.documentTabs.replaceDocumentSession(documentId, nextSession);
  }

  private closeDocumentSession(documentId: string): void {
    return this.documentTabs.closeDocumentSession(documentId);
  }

  private closeDocumentSessions(documentIds: string[], status: string): void {
    return this.documentTabs.closeDocumentSessions(documentIds, status);
  }

  private closeDocumentSessionsWithOptions(
    documentIds: string[],
    status: string,
    options: { clearSettingsTab?: boolean } = {}
  ): void {
    return this.documentTabs.closeDocumentSessionsWithOptions(
      documentIds,
      status,
      options
    );
  }

  private getDocumentById(documentId: string): DocumentSession | null {
    return this.state.getDocumentById(documentId);
  }

  private getDocumentByDesktopPath(filePath: string): DocumentSession | null {
    return this.state.getDocumentByDesktopPath(filePath);
  }

  private getCurrentDocumentIdForClose(document: DocumentSession): string {
    return this.documentTabs.getCurrentDocumentIdForClose(document);
  }

  private async closeActiveDocumentSession(): Promise<void> {
    return this.closing.closeActiveDocumentSession();
  }

  private async closeDocumentsWithProtection(
    documents: DocumentSession[],
    status: string,
    options: { clearSettingsTab?: boolean } = {}
  ): Promise<boolean> {
    return this.closing.closeDocumentsWithProtection(
      documents,
      status,
      options
    );
  }

  private async closeDocumentsAndMaybeSettings(
    documents: DocumentSession[],
    shouldCloseSettings: boolean,
    status: string
  ): Promise<void> {
    return this.closing.closeDocumentsAndMaybeSettings(
      documents,
      shouldCloseSettings,
      status
    );
  }

  private emitCloseSettingsTab(): void {
    return this.closing.emitCloseSettingsTab();
  }

  private async confirmDiscardProtectedDocuments(
    documents: DocumentSession[],
    action: "close-tab" | "quit" | "reload"
  ): Promise<boolean> {
    return this.closing.confirmDiscardProtectedDocuments(documents, action);
  }

  private async confirmReloadConflictedDocument(): Promise<boolean> {
    return this.closing.confirmReloadConflictedDocument();
  }

  private async confirmDiscardDocumentsSequentially(
    documents: DocumentSession[]
  ): Promise<boolean> {
    return this.closing.confirmDiscardDocumentsSequentially(documents);
  }

  private async resolveProtectedDocumentClose(
    documents: DocumentSession[],
    action: "close-tab" | "quit" | "switch-workspace"
  ): Promise<boolean> {
    return this.closing.resolveProtectedDocumentClose(documents, action);
  }

  private async resolveProtectedDocumentsSequentially(
    documents: DocumentSession[]
  ): Promise<boolean> {
    return this.closing.resolveProtectedDocumentsSequentially(documents);
  }

  private async saveDocumentsBeforeClose(
    documents: DocumentSession[]
  ): Promise<boolean> {
    return this.closing.saveDocumentsBeforeClose(documents);
  }

  private updateActiveFileWatcher(): void {
    const activeDocument = this.getActiveDocument();
    const activePath =
      activeDocument?.location.kind === "desktop-path"
        ? activeDocument.location.path
        : null;

    this.activeFileWatcher.update(activePath);
  }

  private updateWorkspaceWatcher(): void {
    this.workspaceWatcher.update(this.shellData.workspacePath);
  }

  private refreshWorkspaceEntries(): Promise<void> {
    this.workspaceRefreshVersion += 1;

    if (this.workspaceRefreshPromise) {
      return this.workspaceRefreshPromise;
    }

    const refresh = async () => {
      let completedVersion = 0;

      while (completedVersion !== this.workspaceRefreshVersion) {
        const refreshVersion = this.workspaceRefreshVersion;
        const workspacePath = this.shellData.workspacePath;
        completedVersion = refreshVersion;

        if (!workspacePath) {
          continue;
        }

        const workspaceEntries = await tryCollectWorkspaceEntries(
          this.dependencies.fileSystem,
          workspacePath,
          {
            respectGitIgnore: this.dependencies.getWorkspaceRespectGitIgnore(),
            showHiddenFiles: this.dependencies.getWorkspaceShowHiddenFiles()
          }
        );

        if (
          refreshVersion !== this.workspaceRefreshVersion ||
          workspacePath !== this.shellData.workspacePath
        ) {
          continue;
        }

        this.updateShellData({
          workspaceEntries
        });
        this.emitShellSnapshot();
      }
    };
    const refreshPromise = refresh().finally(() => {
      if (this.workspaceRefreshPromise === refreshPromise) {
        this.workspaceRefreshPromise = null;
      }
    });
    this.workspaceRefreshPromise = refreshPromise;
    return refreshPromise;
  }

  private async handleActiveFileExternalChange(
    filePath: string
  ): Promise<void> {
    const activeDocument = this.getActiveDocument();

    if (
      !activeDocument ||
      activeDocument.location.kind !== "desktop-path" ||
      activeDocument.location.path !== filePath
    ) {
      return;
    }

    await this.reconcileDocumentWithDisk(activeDocument.id, {
      emitSnapshot: true
    });
  }

  private async reconcileDocumentWithDisk(
    documentId: string,
    options: { emitSnapshot: boolean }
  ): Promise<void> {
    const documentToReconcile = this.getDocumentById(documentId);

    if (
      !documentToReconcile ||
      documentToReconcile.location.kind !== "desktop-path" ||
      this.selfWritePaths.has(documentToReconcile.location.path)
    ) {
      return;
    }

    const currentMetadata = await this.dependencies.fileSystem.getMetadata(
      documentToReconcile.location
    );

    if (!currentMetadata) {
      this.updateShellData({
        documents: this.shellData.documents.map((document) =>
          document.id === documentToReconcile.id
            ? markDocumentSessionConflict(document)
            : document
        ),
        status: "Active file was deleted on disk."
      });
      if (options.emitSnapshot) {
        this.emitShellSnapshot();
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

    this.autosaveScheduler.clear(documentToReconcile.id);

    if (documentToReconcile.rawText === documentToReconcile.lastSavedText) {
      const nextSession = await createSessionForFilePath(
        this.dependencies.fileSystem,
        documentToReconcile.location.path,
        this.dependencies.analyzeMarkdownMode
      );

      if (!nextSession) {
        this.updateShellData({
          documents: this.shellData.documents.map((document) =>
            document.id === documentToReconcile.id
              ? markDocumentSessionConflict(document)
              : document
          ),
          status: "Active file changed on disk but could not be reloaded."
        });
        if (options.emitSnapshot) {
          this.emitShellSnapshot();
        }
        return;
      }

      this.updateShellData({
        documents: this.shellData.documents.map((document) =>
          document.id === documentToReconcile.id ? nextSession : document
        ),
        status: "Active file reloaded from disk."
      });
      if (options.emitSnapshot) {
        this.emitShellSnapshot();
      }
      return;
    }

    this.updateShellData({
      documents: this.shellData.documents.map((document) =>
        document.id === documentToReconcile.id
          ? markDocumentSessionExternalChange(document)
          : document
      ),
      status: "Active file changed on disk."
    });
    if (options.emitSnapshot) {
      this.emitShellSnapshot();
    }
  }

  private async openFilePath(
    filePath: string,
    options: {
      workspacePath?: string | null;
    } = {}
  ): Promise<void> {
    return this.opening.openFilePath(filePath, options);
  }

  private async openFolderPath(directoryPath: string): Promise<void> {
    if (directoryPath === this.shellData.workspacePath) {
      this.emitToRenderer({
        type: "status",
        message: `Workspace ${path.basename(directoryPath)} is already open.`
      });
      return;
    }

    const protectedDocuments = this.getProtectedDocuments();

    if (
      protectedDocuments.length > 0 &&
      !(await this.resolveProtectedDocumentClose(
        protectedDocuments,
        "switch-workspace"
      ))
    ) {
      this.emitToRenderer({
        type: "status",
        message: "Workspace switch cancelled."
      });
      this.emitShellSnapshot();
      return;
    }

    this.closeDocumentSessions(
      this.shellData.documents.map((document) => document.id),
      "Closed documents for workspace switch."
    );

    this.updateShellData({
      activeDocumentId: null,
      activeTabId: null,
      documents: [],
      status: `Opened workspace ${path.basename(directoryPath)}.`,
      workspaceEntries: [],
      workspacePath: directoryPath
    });
    this.syncEditorModeForActiveDocument();
    this.autosaveScheduler.clearAll();
    this.updateActiveFileWatcher();
    this.updateWorkspaceWatcher();
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
    await this.refreshWorkspaceEntries();
  }

  private async saveActiveDocument(): Promise<void> {
    const activeDocument = this.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      this.emitToRenderer({
        type: "status",
        message: "No active document to save."
      });
      return;
    }

    await this.saveDocument(activeDocument.id, "manual");
  }

  private async createNewMarkdownFile(): Promise<void> {
    return this.opening.createNewMarkdownFile();
  }

  private async saveActiveDocumentAs(): Promise<void> {
    const activeDocument = this.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      this.emitToRenderer({
        type: "status",
        message: "No active document to save."
      });
      return;
    }

    if (activeDocument.location.kind === "app-draft") {
      await this.promoteDraftDocument(activeDocument);
      return;
    }

    const result = await dialog.showSaveDialog(this.window, {
      defaultPath: this.getDefaultSaveAsPath(activeDocument),
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "Save Markdown File As"
    });

    if (result.canceled || !result.filePath) {
      this.emitToRenderer({ type: "status", message: "Save As cancelled." });
      return;
    }

    const textToSave = this.prepareTextForSave(activeDocument);
    const saveResult = await this.dependencies.fileSystem.writeTextAtomic(
      { kind: "desktop-path", path: result.filePath },
      textToSave
    );

    if (saveResult.kind !== "success") {
      this.emitToRenderer({
        type: "status",
        message:
          saveResult.kind === "conflict"
            ? `Save As conflict: file was ${saveResult.reason}.`
            : `Save As failed: ${saveResult.message}`
      });
      return;
    }

    await this.openFilePath(result.filePath);
    await this.refreshWorkspaceEntries();
  }

  private async saveDraftDocument(document: DocumentSession): Promise<boolean> {
    if (document.location.kind !== "app-draft") {
      return false;
    }

    this.autosaveScheduler.clear(document.id);
    const savedText = document.rawText;
    const metadata = await this.dependencies.draftStorage.writeDraft(
      document.location,
      savedText
    );
    this.updateShellData({
      documents: this.shellData.documents.map((candidate) =>
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
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
    return true;
  }

  private async promoteDraftDocument(
    document: DocumentSession
  ): Promise<boolean> {
    if (document.location.kind !== "app-draft") {
      return false;
    }

    const result = await dialog.showSaveDialog(this.window, {
      defaultPath: this.getDefaultSaveAsPath(document),
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "Save Markdown File"
    });

    if (result.canceled || !result.filePath) {
      this.emitToRenderer({ type: "status", message: "Save cancelled." });
      return false;
    }

    const textToSave = this.prepareTextForSave(document);
    const fileLocation = {
      kind: "desktop-path" as const,
      path: result.filePath
    };
    const saveResult = await this.dependencies.fileSystem.writeTextAtomic(
      fileLocation,
      textToSave
    );

    if (saveResult.kind !== "success") {
      this.emitToRenderer({
        type: "status",
        message:
          saveResult.kind === "conflict"
            ? `Save conflict: file was ${saveResult.reason}.`
            : `Save failed: ${saveResult.message}`
      });
      return false;
    }

    await this.dependencies.draftStorage.deleteDraft(document.location);
    const nextSession =
      (await createSessionForFilePath(
        this.dependencies.fileSystem,
        result.filePath,
        this.dependencies.analyzeMarkdownMode
      )) ??
      createDocumentSession({
        location: fileLocation,
        metadata: saveResult.metadata,
        rawText: textToSave
      });

    this.autosaveScheduler.clear(document.id);
    this.replaceDocumentSession(document.id, nextSession);
    this.updateShellData({
      status: `Saved ${path.basename(result.filePath)}.`
    });
    await this.refreshWorkspaceEntries();
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
    return true;
  }

  private async renameDocument(documentId: string): Promise<void> {
    return this.fileOperations.renameDocument(documentId);
  }

  private saveDocument(
    documentId: string,
    trigger: "autosave" | "manual"
  ): Promise<boolean> {
    return this.saveQueue.enqueue(documentId, () =>
      this.performSaveDocument(documentId, trigger).catch((error: unknown) => {
        const document = this.getDocumentById(documentId);

        if (document) {
          this.updateShellData({
            documents: this.shellData.documents.map((candidate) =>
              candidate.id === documentId
                ? markDocumentSessionSaveError(candidate)
                : candidate
            ),
            status:
              error instanceof Error
                ? `Save failed: ${error.message}`
                : "Save failed."
          });
          this.emitShellSnapshot();
        }

        return false;
      })
    );
  }

  private async performSaveDocument(
    documentId: string,
    trigger: "autosave" | "manual"
  ): Promise<boolean> {
    const activeDocument = this.shellData.documents.find(
      (document) => document.id === documentId
    );

    if (!activeDocument) {
      return false;
    }

    if (activeDocument.saveState === "idle") {
      if (
        trigger === "manual" &&
        activeDocument.location.kind === "app-draft"
      ) {
        return this.promoteDraftDocument(activeDocument);
      }

      return true;
    }

    if (
      activeDocument.saveState === "conflict" ||
      activeDocument.saveState === "external-change"
    ) {
      this.emitToRenderer({
        type: "status",
        message: "Resolve the disk conflict before saving."
      });
      return false;
    }

    if (activeDocument.location.kind === "app-draft") {
      if (trigger === "autosave") {
        return this.saveDraftDocument(activeDocument);
      } else {
        return this.promoteDraftDocument(activeDocument);
      }
    }

    if (activeDocument.location.kind !== "desktop-path") {
      this.emitToRenderer({
        type: "status",
        message: "Save is only available for desktop files."
      });
      return false;
    }

    this.autosaveScheduler.clear(activeDocument.id);

    const textToSave = this.prepareTextForSave(
      activeDocument,
      activeDocument.rawText
    );

    this.updateShellData({
      documents: this.shellData.documents.map((document) =>
        document.id === activeDocument.id
          ? markDocumentSessionSaving(document)
          : document
      ),
      status:
        trigger === "autosave"
          ? `Autosaving ${path.basename(activeDocument.location.path)}.`
          : `Saving ${path.basename(activeDocument.location.path)}.`
    });
    this.emitShellSnapshot();

    const activeDocumentPath = activeDocument.location.path;

    this.selfWritePaths.add(activeDocumentPath);
    const saveResult = await this.dependencies.fileSystem.writeTextAtomic(
      activeDocument.location,
      textToSave,
      {
        expectedMetadata: activeDocument.lastSavedMetadata
      }
    );
    setTimeout(() => {
      this.selfWritePaths.delete(activeDocumentPath);
    }, 150);

    if (saveResult.kind === "success") {
      this.updateShellData({
        documents: this.shellData.documents.map((document) =>
          document.id === activeDocument.id
            ? markDocumentAfterSuccessfulWrite(
                document,
                textToSave,
                saveResult.metadata,
                activeDocument.rawText
              )
            : document
        ),
        status:
          trigger === "autosave"
            ? `Autosaved ${path.basename(activeDocument.location.path)}.`
            : `Saved ${path.basename(activeDocument.location.path)}.`
      });
      this.persistSessionStateSoon();
      this.emitShellSnapshot();
      return true;
    }

    if (saveResult.kind === "conflict") {
      this.updateShellData({
        documents: this.shellData.documents.map((document) =>
          document.id === activeDocument.id
            ? markDocumentSessionConflict(document)
            : document
        ),
        status: `Save conflict: file was ${saveResult.reason}.`
      });
      this.emitShellSnapshot();
      return false;
    }

    this.updateShellData({
      documents: this.shellData.documents.map((document) =>
        document.id === activeDocument.id
          ? markDocumentSessionSaveError({
              ...document,
              rawText: textToSave
            })
          : document
      ),
      status: `Save failed: ${saveResult.message}`
    });
    this.emitShellSnapshot();
    return false;
  }

  private async reloadActiveDocumentFromDisk(): Promise<void> {
    const activeDocument = this.getActiveDocumentForActiveTab();

    if (!activeDocument || activeDocument.location.kind !== "desktop-path") {
      this.emitToRenderer({
        type: "status",
        message: "No desktop file to reload."
      });
      return;
    }

    if (
      activeDocument.saveState === "conflict" &&
      !(await this.confirmReloadConflictedDocument())
    ) {
      this.emitToRenderer({ type: "status", message: "Reload cancelled." });
      return;
    }

    if (
      activeDocument.saveState !== "conflict" &&
      shouldProtectDocumentSessionClose(activeDocument) &&
      !(await this.confirmDiscardProtectedDocuments([activeDocument], "reload"))
    ) {
      this.emitToRenderer({ type: "status", message: "Reload cancelled." });
      return;
    }

    const nextSession = await createSessionForFilePath(
      this.dependencies.fileSystem,
      activeDocument.location.path,
      this.dependencies.analyzeMarkdownMode
    );

    if (!nextSession) {
      this.emitToRenderer({
        type: "status",
        message: "Could not reload file from disk."
      });
      return;
    }

    this.updateShellData({
      documents: this.shellData.documents.map((document) =>
        document.id === activeDocument.id ? nextSession : document
      ),
      status: `Reloaded ${path.basename(activeDocument.location.path)} from disk.`
    });
    this.syncEditorModeForActiveDocument();
    this.emitShellSnapshot();
    this.emitToRenderer({
      type: "document-baseline-reset",
      documentId: activeDocument.id
    });
  }

  private prepareTextForSave(
    document: DocumentSession,
    text = document.rawText
  ): string {
    if (document.lineEnding === "crlf" || document.lineEnding === "lf") {
      return applyLineEnding(text, document.lineEnding);
    }

    if (document.lineEnding === "none") {
      return applyLineEnding(text, this.getWritableDefaultLineEnding());
    }

    return text;
  }

  private getWritableDefaultLineEnding(): "crlf" | "lf" {
    return resolveDefaultLineEnding(
      this.dependencies.getDefaultLineEnding(),
      process.platform
    );
  }

  private async keepEditingActiveDocument(): Promise<void> {
    const activeDocument = this.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      return;
    }

    const metadata =
      activeDocument.location.kind === "desktop-path"
        ? await this.dependencies.fileSystem.getMetadata(
            activeDocument.location
          )
        : activeDocument.lastSavedMetadata;

    this.updateShellData({
      documents: this.shellData.documents.map((document) =>
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
    this.emitShellSnapshot();
  }

  private revealDocumentInWorkspace(document: DocumentSession): void {
    return this.fileOperations.revealDocumentInWorkspace(document);
  }

  private async openFileFromDialog(): Promise<void> {
    return this.opening.openFileFromDialog();
  }

  private async openFolderFromDialog(): Promise<void> {
    const result = await dialog.showOpenDialog(this.window, {
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      this.emitToRenderer({
        type: "status",
        message: "Open folder cancelled."
      });
      return;
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      this.emitToRenderer({
        type: "status",
        message: "Open folder did not return a path."
      });
      return;
    }

    await this.openFolderPath(selectedPath);
  }

  private deleteDraftSoon(document: DocumentSession): void {
    if (document.location.kind !== "app-draft") {
      return;
    }

    const draftLocation = document.location;
    const pendingSave = this.saveQueue.waitFor(document.id);
    void pendingSave
      .then(() => this.dependencies.draftStorage.deleteDraft(draftLocation))
      .catch((error) => {
        this.emitToRenderer({
          type: "status",
          message:
            error instanceof Error
              ? `Could not delete draft: ${error.message}`
              : "Could not delete draft."
        });
      });
  }

  private getWorkspaceFileActions(): WorkspaceFileActions {
    this.workspaceFileActions ??= createWorkspaceFileActions({
      onCommand: (request) => {
        void this.handleContextCommand(request, true).catch((error: unknown) =>
          this.emitStatus(String(error))
        );
      },
      closeDocumentSessions: (documentIds, status) =>
        this.closeDocumentSessions(documentIds, status),
      confirmDiscardDocumentsSequentially: (documents) =>
        this.confirmDiscardDocumentsSequentially(documents),
      emitShellSnapshot: () => this.emitShellSnapshot(),
      emitStatus: (message) => this.emitToRenderer({ type: "status", message }),
      fileSystem: this.dependencies.fileSystem,
      getDocuments: () => this.shellData.documents,
      getDefaultLineEnding: () => this.dependencies.getDefaultLineEnding(),
      getMainWindow: () => this.window,
      getWorkspacePath: () => this.shellData.workspacePath,
      openFilePath: (filePath, options) => this.openFilePath(filePath, options),
      openFolderSearch: (folderPath) =>
        this.emitToRenderer({ type: "find-in-folder", path: folderPath }),
      persistSessionStateSoon: () => this.persistSessionStateSoon(),
      refreshWorkspaceEntries: () => this.refreshWorkspaceEntries(),
      selfWritePaths: this.selfWritePaths
    });

    return this.workspaceFileActions;
  }

  private isValidWorkspaceTarget(
    targetPath: string,
    kind: "file" | "folder"
  ): boolean {
    const workspacePath = this.shellData.workspacePath;

    if (!workspacePath) {
      return false;
    }

    if (targetPath === workspacePath) {
      return kind === "folder";
    }

    return (
      isPathInsideDirectory(workspacePath, targetPath) &&
      this.shellData.workspaceEntries.some(
        (entry) => entry.path === targetPath && entry.kind === kind
      )
    );
  }
}

function isWorkspaceSearchOptions(
  options: unknown
): options is WorkspaceSearchOptions {
  return (
    typeof options === "object" &&
    options !== null &&
    typeof (options as { caseSensitive?: unknown }).caseSensitive ===
      "boolean" &&
    typeof (options as { regexp?: unknown }).regexp === "boolean" &&
    typeof (options as { wholeWord?: unknown }).wholeWord === "boolean"
  );
}

function createDocumentModeKeyFromPersistedReference(
  documentRef: PersistedDocumentReference
): string {
  return documentRef.kind === "app-draft"
    ? `app-draft:${documentRef.draftId}`
    : `desktop-path:${documentRef.path}`;
}

function prioritizeActiveDocumentRef(
  documentRefs: PersistedDocumentReference[],
  persistedState: PersistedWindowSessionState
): PersistedDocumentReference[] {
  const activeKey = persistedState.activeDocumentRef
    ? createDocumentModeKeyFromPersistedReference(
        persistedState.activeDocumentRef
      )
    : persistedState.activeDocumentPath
      ? createDocumentModeKeyFromPersistedReference({
          kind: "desktop-path",
          path: persistedState.activeDocumentPath
        })
      : null;

  if (!activeKey) {
    return documentRefs;
  }

  const activeIndex = documentRefs.findIndex(
    (documentRef) =>
      createDocumentModeKeyFromPersistedReference(documentRef) === activeKey
  );

  if (activeIndex <= 0) {
    return documentRefs;
  }

  return [
    documentRefs[activeIndex]!,
    ...documentRefs.slice(0, activeIndex),
    ...documentRefs.slice(activeIndex + 1)
  ];
}

function getLoadedDocumentsInPersistedOrder(
  documentRefs: PersistedDocumentReference[],
  loadedDocuments: ReadonlyMap<string, DocumentSession>
): DocumentSession[] {
  const includedDocumentIds = new Set<string>();

  return documentRefs.flatMap((documentRef) => {
    const document = loadedDocuments.get(
      createDocumentModeKeyFromPersistedReference(documentRef)
    );

    if (!document || includedDocumentIds.has(document.id)) {
      return [];
    }

    includedDocumentIds.add(document.id);
    return [document];
  });
}
