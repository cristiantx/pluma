import { dialog, type BrowserWindow } from "electron";
import { rename, stat } from "node:fs/promises";
import path from "node:path";

import {
  createDocumentSession,
  formatMarkdownText,
  getFileLocationName,
  markDocumentSessionConflict,
  markDocumentSessionExternalChange,
  markDocumentSessionSaveError,
  markDocumentSessionSaved,
  markDocumentSessionSaving,
  serializeMarkdownSession,
  shouldProtectDocumentSessionClose,
  updateDocumentSessionText,
  type AppDraftFileLocation,
  type DesktopFileLocation,
  type DocumentCapability,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import type {
  CommandName,
  DesktopShellSnapshot,
  EditorViewMode,
  RendererEvent,
  WorkspaceSearchMatch,
  WorkspaceSearchOptions
} from "../../shared/shellState";
import {
  isEditorViewMode,
  type PersistedDocumentReference,
  type PersistedWindowSessionState
} from "../persistence/appPersistence";
import type { AppDraftStorage } from "../persistence/appDraftStorage";
import { AutosaveScheduler } from "../autosave/autosaveScheduler";
import {
  confirmDiscardDocumentsSequentially as confirmDiscardDocumentsSequentiallyDialog,
  confirmDiscardProtectedDocuments as confirmDiscardProtectedDocumentsDialog
} from "../dialogs/documentProtection";
import { buildTabContextMenu } from "../menus/tabContextMenu";
import { ActiveFileWatcher } from "../watching/activeFileWatcher";
import { WorkspaceWatcher } from "../watching/workspaceWatcher";
import {
  collectWorkspaceEntries,
  createSessionForFilePath,
  isMarkdownFilePath,
  isPathInsideDirectory,
  tryCollectWorkspaceEntries,
  tryCreateSessionForFilePath
} from "../workspace/desktopWorkspace";
import {
  createWorkspaceFileActions,
  type WorkspaceFileActions
} from "../workspace/workspaceFileActions";
import { searchMarkdownWorkspace } from "../workspace/workspaceSearch";
import {
  exportDocument,
  type ExportDocumentResult
} from "../export/desktopExport";
import type { ExportDocumentFormat } from "../export/exportDocumentHtml";
import { markDocumentAfterSuccessfulWrite } from "./documentSaveState";
import {
  getActivePersistedDocument,
  getPersistedDocumentReference
} from "./persistedDocumentRefs";

export type DesktopWindowSessionDependencies = {
  appDocumentsPath: string;
  autosaveDelayMs: number;
  draftStorage: AppDraftStorage;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getAutosaveEnabled: () => boolean;
  isDevelopment: boolean;
  onMenuStateChange: () => void;
  onPersistSessionState: () => void;
  selfWritePaths: Set<string>;
  window: BrowserWindow;
};

export class DesktopWindowSession {
  private readonly activeFileWatcher: ActiveFileWatcher;
  private readonly autosaveScheduler: AutosaveScheduler;
  private readonly workspaceWatcher: WorkspaceWatcher;
  private currentMode: EditorViewMode = "source";
  private shellData: DesktopShellSnapshot;
  private workspaceFileActions: WorkspaceFileActions | null = null;

  constructor(private readonly dependencies: DesktopWindowSessionDependencies) {
    this.shellData = {
      activeDocumentId: null,
      documents: [],
      isDevelopment: dependencies.isDevelopment,
      paneSizes: [],
      status: "Starting desktop shell...",
      workspaceEntries: [],
      workspacePath: null
    };

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
  }

  emitInitialState(): void {
    this.emitToRenderer({ type: "mode-changed", mode: this.currentMode });
    this.updateShellData({
      status:
        "Desktop shell ready. Workspace loading and document sessions are available."
    });
    this.emitShellSnapshot();
  }

  getPersistedState(): PersistedWindowSessionState {
    const activeDocument = this.getActiveDocument();
    const activeDocumentRef = activeDocument
      ? getPersistedDocumentReference(activeDocument)
      : null;

    return {
      activeDocumentRef,
      activeDocumentPath: this.getDocumentPath(this.shellData.activeDocumentId),
      documentRefs: this.shellData.documents.flatMap((document) => {
        const documentRef = getPersistedDocumentReference(document);

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

  hasActiveDocument(): boolean {
    return this.getActiveDocument() !== null;
  }

  async restorePersistedState(
    persistedState: PersistedWindowSessionState
  ): Promise<void> {
    this.currentMode = persistedState.editorMode;

    const workspaceEntries = await tryCollectWorkspaceEntries(
      this.dependencies.fileSystem,
      persistedState.workspacePath
    );
    const documentRefs =
      persistedState.documentRefs ??
      persistedState.documentPaths.map((documentPath) => ({
        kind: "desktop-path" as const,
        path: documentPath
      }));
    const documents = (
      await Promise.all(
        documentRefs.map((documentRef) =>
          this.createSessionForPersistedDocumentRef(documentRef)
        )
      )
    ).filter((session) => session !== null);
    const activeDocument = getActivePersistedDocument(
      documents,
      persistedState
    );

    this.updateShellData({
      activeDocumentId: activeDocument?.id ?? null,
      documents,
      paneSizes: persistedState.paneSizes ?? [],
      status:
        documents.length > 0 || persistedState.workspacePath
          ? "Restored previous session."
          : "Desktop shell ready.",
      workspaceEntries,
      workspacePath: persistedState.workspacePath
    });
    this.clampEditorModeForActiveDocument({ emit: false });
    this.updateActiveFileWatcher();
    this.updateWorkspaceWatcher();
  }

  async handleOpenTarget(targetPath: string): Promise<void> {
    try {
      const targetStats = await stat(targetPath);

      if (targetStats.isDirectory()) {
        await this.openFolderPath(targetPath);
        return;
      }

      if (targetStats.isFile() && isMarkdownFilePath(targetPath)) {
        await this.openFilePath(targetPath);
      }
    } catch (error) {
      this.emitToRenderer({
        type: "status",
        message:
          error instanceof Error
            ? error.message
            : `Failed to open "${targetPath}".`
      });
    }
  }

  async handleCommand(command: CommandName): Promise<void> {
    switch (command) {
      case "close-active-tab":
        await this.closeActiveDocumentSession();
        return;
      case "compare-conflict":
        this.showManualCompareStatus();
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
        return;
      case "open-file":
        await this.openFileFromDialog();
        return;
      case "open-folder":
        await this.openFolderFromDialog();
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
        this.currentMode = this.getNextEditorMode();
        this.emitToRenderer({ type: "mode-changed", mode: this.currentMode });
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

    return searchMarkdownWorkspace({
      folderPath: typeof folderPath === "string" ? folderPath : null,
      options,
      query,
      workspacePath: this.shellData.workspacePath
    });
  }

  setEditorMode(mode: unknown): void {
    if (!isEditorViewMode(mode)) {
      return;
    }

    this.currentMode = this.getAllowedEditorMode(mode);
    this.emitToRenderer({ type: "mode-changed", mode: this.currentMode });
    this.persistSessionStateSoon();
  }

  setActiveDocument(documentId: unknown): void {
    if (
      typeof documentId !== "string" ||
      !this.shellData.documents.some((document) => document.id === documentId)
    ) {
      return;
    }

    this.updateShellData({ activeDocumentId: documentId });
    this.clampEditorModeForActiveDocument();
    this.updateActiveFileWatcher();
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
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
    const document = this.getDocumentById(tabId);

    if (
      document &&
      shouldProtectDocumentSessionClose(document) &&
      !(await this.confirmDiscardProtectedDocuments([document], "close-tab"))
    ) {
      this.emitToRenderer({ type: "status", message: "Close tab cancelled." });
      this.emitShellSnapshot();
      return;
    }

    this.closeDocumentSession(tabId);
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  showTabContextMenu(documentId: string): void {
    const document = this.getDocumentById(documentId);

    if (!document) {
      return;
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
    const menu = buildTabContextMenu({
      canCloseAll: this.shellData.documents.length > 0,
      canCloseOthers: otherDocuments.length > 0,
      canCloseSavedTabs: savedDocuments.length > 0,
      canCopyPath: hasDesktopPath,
      canRename: hasDesktopPath,
      canRevealInWorkspace,
      canShowInFolder: hasDesktopPath,
      onClose: () =>
        void this.closeDocumentsWithProtection(
          [document],
          "Closed document tab."
        ),
      onCloseOthers: () =>
        void this.closeDocumentsWithProtection(
          otherDocuments,
          "Closed other document tabs."
        ),
      onCloseSavedTabs: () =>
        void this.closeDocumentsWithProtection(
          savedDocuments,
          "Closed saved document tabs."
        ),
      onCloseAll: () =>
        void this.closeDocumentsWithProtection(
          this.shellData.documents,
          "Closed all document tabs."
        ),
      onRename: () => void this.renameDocument(document.id),
      onCopyPath: () =>
        this.getWorkspaceFileActions().copyDocumentPath(document.id),
      onShowInFolder: () =>
        this.getWorkspaceFileActions().showDocumentInFolder(document.id),
      onRevealInWorkspace: () => this.revealDocumentInWorkspace(document)
    });

    menu.popup({ window: this.window });
  }

  showWorkspaceContextMenu(targetPath: unknown, kind: unknown): void {
    if (
      typeof targetPath !== "string" ||
      (kind !== "file" && kind !== "folder")
    ) {
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

    const nextDocuments = this.shellData.documents.map((document) =>
      document.id === documentId
        ? updateDocumentSessionText(document, rawText)
        : document
    );

    this.updateShellData({
      documents: nextDocuments,
      status: "Document edited."
    });
    const nextDocument = nextDocuments.find(
      (document) => document.id === documentId
    );
    if (nextDocument?.saveState === "dirty") {
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
    this.emitShellSnapshot();
  }

  async closeWindowWithProtection(): Promise<boolean> {
    const protectedDocuments = this.getProtectedDocuments();

    if (protectedDocuments.length === 0) {
      return true;
    }

    const canClose = await this.confirmDiscardProtectedDocuments(
      protectedDocuments,
      "quit"
    );

    if (!canClose) {
      this.emitToRenderer({ type: "status", message: "Quit cancelled." });
    }

    return canClose;
  }

  emitStatus(message: string): void {
    this.emitToRenderer({ type: "status", message });
  }

  emitSettingsChanged(spellcheckEnabled: boolean): void {
    this.emitToRenderer({
      spellcheckEnabled,
      type: "settings-changed"
    });
  }

  private emitToRenderer(event: RendererEvent): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send("pluma:event", event);
    }
  }

  private emitShellSnapshot(): void {
    this.emitToRenderer({
      type: "shell-snapshot",
      snapshot: this.shellData
    });
  }

  private updateShellData(
    update: Partial<DesktopShellSnapshot>
  ): DesktopShellSnapshot {
    const hadActiveDocument = this.hasActiveDocument();

    this.shellData = {
      ...this.shellData,
      ...update
    };

    if (hadActiveDocument !== this.hasActiveDocument()) {
      this.dependencies.onMenuStateChange();
    }

    return this.shellData;
  }

  private getDocumentPath(documentId: string | null): string | null {
    const document = this.shellData.documents.find(
      (candidate) => candidate.id === documentId
    );

    if (document?.location.kind !== "desktop-path") {
      return null;
    }

    return document.location.path;
  }

  private getActiveDocumentCapability(): DocumentCapability | null {
    const activeDocument = this.shellData.documents.find(
      (document) => document.id === this.shellData.activeDocumentId
    );

    return activeDocument?.capability ?? null;
  }

  private getActiveDocument(): DocumentSession | null {
    return (
      this.shellData.documents.find(
        (document) => document.id === this.shellData.activeDocumentId
      ) ?? null
    );
  }

  private getAllowedEditorMode(mode: EditorViewMode): EditorViewMode {
    return mode !== "source" &&
      this.getActiveDocumentCapability() === "source-only"
      ? "source"
      : mode;
  }

  private getNextEditorMode(): EditorViewMode {
    return this.getAllowedEditorMode(
      this.currentMode === "rich" ? "source" : "rich"
    );
  }

  private clampEditorModeForActiveDocument(
    options: { emit?: boolean } = {}
  ): void {
    const previousMode = this.currentMode;
    this.currentMode = this.getAllowedEditorMode(this.currentMode);

    if (options.emit !== false && previousMode !== this.currentMode) {
      this.emitToRenderer({ type: "mode-changed", mode: this.currentMode });
    }
  }

  private getDefaultNewFilePath(): string {
    return path.join(
      this.shellData.workspacePath ?? this.dependencies.appDocumentsPath,
      "Untitled.md"
    );
  }

  private getDefaultSaveAsPath(document: DocumentSession): string {
    if (document.location.kind === "app-draft") {
      return path.join(
        this.shellData.workspacePath ?? this.dependencies.appDocumentsPath,
        `${document.location.name}.md`
      );
    }

    if (document.location.kind === "desktop-path") {
      const parsedPath = path.parse(document.location.path);

      return path.join(
        parsedPath.dir,
        `${parsedPath.name} copy${parsedPath.ext}`
      );
    }

    return this.getDefaultNewFilePath();
  }

  private async exportActiveDocument(
    format: ExportDocumentFormat
  ): Promise<void> {
    const activeDocument = this.getActiveDocument();

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

      this.handleExportResult(result, format);
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

  private handleExportResult(
    result: ExportDocumentResult,
    format: ExportDocumentFormat
  ): void {
    if (result.kind === "cancelled") {
      this.emitToRenderer({ type: "status", message: "Export cancelled." });
      return;
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
    const usedNames = new Set(
      this.shellData.documents
        .filter((document) => document.location.kind === "app-draft")
        .map((document) => getFileLocationName(document.location))
    );
    let index = 1;

    while (usedNames.has(`Untitled-${index}`)) {
      index += 1;
    }

    return `Untitled-${index}`;
  }

  private async createSessionForPersistedDocumentRef(
    documentRef: PersistedDocumentReference
  ): Promise<DocumentSession | null> {
    if (documentRef.kind === "desktop-path") {
      return tryCreateSessionForFilePath(
        this.dependencies.fileSystem,
        documentRef.path
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

    return createDocumentSession({
      location,
      metadata: null,
      rawText
    });
  }

  private persistSessionStateSoon(): void {
    this.dependencies.onPersistSessionState();
  }

  private mergeDocumentSession(nextSession: DocumentSession): void {
    const remainingDocuments = this.shellData.documents.filter(
      (document) => document.id !== nextSession.id
    );

    this.updateShellData({
      activeDocumentId: nextSession.id,
      documents: [nextSession, ...remainingDocuments]
    });
    this.clampEditorModeForActiveDocument();
    this.updateActiveFileWatcher();
  }

  private replaceDocumentSession(
    documentId: string,
    nextSession: DocumentSession
  ): void {
    this.updateShellData({
      activeDocumentId:
        this.shellData.activeDocumentId === documentId
          ? nextSession.id
          : this.shellData.activeDocumentId,
      documents: this.shellData.documents.map((document) =>
        document.id === documentId ? nextSession : document
      )
    });
    this.clampEditorModeForActiveDocument();
    this.updateActiveFileWatcher();
  }

  private closeDocumentSession(documentId: string): void {
    const closingDocument = this.getDocumentById(documentId);

    if (closingDocument?.location.kind === "app-draft") {
      void this.dependencies.draftStorage.deleteDraft(closingDocument.location);
    }

    this.autosaveScheduler.clear(documentId);
    const nextDocuments = this.shellData.documents.filter(
      (document) => document.id !== documentId
    );
    const activeDocumentId =
      this.shellData.activeDocumentId === documentId
        ? (nextDocuments[0]?.id ?? null)
        : this.shellData.activeDocumentId;

    this.updateShellData({
      activeDocumentId,
      documents: nextDocuments,
      status:
        nextDocuments.length === 0
          ? "All documents closed."
          : "Closed document tab."
    });
    this.clampEditorModeForActiveDocument();
    this.updateActiveFileWatcher();
  }

  private closeDocumentSessions(documentIds: string[], status: string): void {
    const documentIdSet = new Set(documentIds);

    for (const documentId of documentIdSet) {
      const closingDocument = this.getDocumentById(documentId);

      if (closingDocument?.location.kind === "app-draft") {
        void this.dependencies.draftStorage.deleteDraft(
          closingDocument.location
        );
      }

      this.autosaveScheduler.clear(documentId);
    }

    const nextDocuments = this.shellData.documents.filter(
      (document) => !documentIdSet.has(document.id)
    );
    const activeDocumentId = documentIdSet.has(
      this.shellData.activeDocumentId ?? ""
    )
      ? (nextDocuments[0]?.id ?? null)
      : this.shellData.activeDocumentId;

    this.updateShellData({
      activeDocumentId,
      documents: nextDocuments,
      status
    });
    this.clampEditorModeForActiveDocument();
    this.updateActiveFileWatcher();
  }

  private getDocumentById(documentId: string): DocumentSession | null {
    return (
      this.shellData.documents.find((document) => document.id === documentId) ??
      null
    );
  }

  private getDocumentByDesktopPath(filePath: string): DocumentSession | null {
    return (
      this.shellData.documents.find(
        (document) =>
          document.location.kind === "desktop-path" &&
          document.location.path === filePath
      ) ?? null
    );
  }

  private async closeActiveDocumentSession(): Promise<void> {
    const activeDocument = this.getActiveDocument();

    if (!activeDocument) {
      this.emitToRenderer({
        type: "status",
        message: "No active document to close."
      });
      return;
    }

    if (
      shouldProtectDocumentSessionClose(activeDocument) &&
      !(await this.confirmDiscardProtectedDocuments(
        [activeDocument],
        "close-tab"
      ))
    ) {
      this.emitToRenderer({ type: "status", message: "Close tab cancelled." });
      this.emitShellSnapshot();
      return;
    }

    this.closeDocumentSession(activeDocument.id);
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  private async closeDocumentsWithProtection(
    documents: DocumentSession[],
    status: string
  ): Promise<void> {
    if (documents.length === 0) {
      this.emitToRenderer({ type: "status", message: "No tabs to close." });
      return;
    }

    const protectedDocuments = documents.filter(
      shouldProtectDocumentSessionClose
    );

    if (!(await this.confirmDiscardDocumentsSequentially(protectedDocuments))) {
      this.emitToRenderer({ type: "status", message: "Close tab cancelled." });
      this.emitShellSnapshot();
      return;
    }

    this.closeDocumentSessions(
      documents.map((document) => document.id),
      status
    );
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  private async confirmDiscardProtectedDocuments(
    documents: DocumentSession[],
    action: "close-tab" | "quit" | "reload"
  ): Promise<boolean> {
    return confirmDiscardProtectedDocumentsDialog(
      this.window,
      documents,
      action
    );
  }

  private async confirmDiscardDocumentsSequentially(
    documents: DocumentSession[]
  ): Promise<boolean> {
    return confirmDiscardDocumentsSequentiallyDialog(this.window, documents);
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

  private async refreshWorkspaceEntries(): Promise<void> {
    if (!this.shellData.workspacePath) {
      return;
    }

    const workspaceEntries = await tryCollectWorkspaceEntries(
      this.dependencies.fileSystem,
      this.shellData.workspacePath
    );

    this.updateShellData({
      workspaceEntries,
      status: "Workspace file tree updated."
    });
    this.emitShellSnapshot();
  }

  private async handleActiveFileExternalChange(
    filePath: string
  ): Promise<void> {
    if (this.dependencies.selfWritePaths.has(filePath)) {
      return;
    }

    const activeDocument = this.getActiveDocument();

    if (
      !activeDocument ||
      activeDocument.location.kind !== "desktop-path" ||
      activeDocument.location.path !== filePath
    ) {
      return;
    }

    const currentMetadata = await this.dependencies.fileSystem.getMetadata(
      activeDocument.location
    );

    if (!currentMetadata) {
      this.updateShellData({
        documents: this.shellData.documents.map((document) =>
          document.id === activeDocument.id
            ? markDocumentSessionConflict(document)
            : document
        ),
        status: "Active file was deleted on disk."
      });
      this.emitShellSnapshot();
      return;
    }

    if (
      activeDocument.lastSavedMetadata &&
      currentMetadata.mtimeMs === activeDocument.lastSavedMetadata.mtimeMs &&
      currentMetadata.size === activeDocument.lastSavedMetadata.size &&
      currentMetadata.fileId === activeDocument.lastSavedMetadata.fileId
    ) {
      return;
    }

    this.autosaveScheduler.clear(activeDocument.id);

    if (activeDocument.rawText === activeDocument.lastSavedText) {
      const nextSession = await createSessionForFilePath(
        this.dependencies.fileSystem,
        filePath
      );

      if (!nextSession) {
        this.updateShellData({
          documents: this.shellData.documents.map((document) =>
            document.id === activeDocument.id
              ? markDocumentSessionConflict(document)
              : document
          ),
          status: "Active file changed on disk but could not be reloaded."
        });
        this.emitShellSnapshot();
        return;
      }

      this.updateShellData({
        documents: this.shellData.documents.map((document) =>
          document.id === activeDocument.id ? nextSession : document
        ),
        status: "Active file reloaded from disk."
      });
      this.emitShellSnapshot();
      return;
    }

    this.updateShellData({
      documents: this.shellData.documents.map((document) =>
        document.id === activeDocument.id
          ? markDocumentSessionExternalChange(document)
          : document
      ),
      status: "Active file changed on disk."
    });
    this.emitShellSnapshot();
  }

  private async openFilePath(
    filePath: string,
    options: {
      workspacePath?: string | null;
    } = {}
  ): Promise<void> {
    const openDocument = this.getDocumentByDesktopPath(filePath);

    if (openDocument) {
      this.updateShellData({
        activeDocumentId: openDocument.id,
        status: `Switched to ${path.basename(filePath)}.`
      });
      this.clampEditorModeForActiveDocument();
      this.updateActiveFileWatcher();
      this.persistSessionStateSoon();
      this.emitShellSnapshot();
      return;
    }

    const session = await createSessionForFilePath(
      this.dependencies.fileSystem,
      filePath
    );

    if (!session) {
      this.emitToRenderer({
        type: "status",
        message: `Could not read metadata for "${filePath}".`
      });
      return;
    }

    const workspacePath =
      options.workspacePath ??
      (this.shellData.workspacePath &&
      isPathInsideDirectory(this.shellData.workspacePath, filePath)
        ? this.shellData.workspacePath
        : null);

    this.mergeDocumentSession(session);
    this.updateShellData({
      status: `Opened ${path.basename(filePath)}.`,
      workspaceEntries: workspacePath ? this.shellData.workspaceEntries : [],
      workspacePath
    });
    this.updateWorkspaceWatcher();
    this.emitToRenderer({ type: "mode-changed", mode: this.currentMode });
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  private async openFolderPath(directoryPath: string): Promise<void> {
    const workspaceEntries = await collectWorkspaceEntries(
      this.dependencies.fileSystem,
      directoryPath
    );

    this.updateShellData({
      activeDocumentId: null,
      documents: [],
      status: `Opened workspace ${path.basename(directoryPath)}.`,
      workspaceEntries,
      workspacePath: directoryPath
    });
    this.clampEditorModeForActiveDocument();
    this.autosaveScheduler.clearAll();
    this.updateActiveFileWatcher();
    this.updateWorkspaceWatcher();
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  private async saveActiveDocument(): Promise<void> {
    const activeDocument = this.getActiveDocument();

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
    const rawText = "# Untitled\n";
    const location = await this.dependencies.draftStorage.createDraft(
      this.getNextDraftName(),
      rawText
    );
    const session = createDocumentSession({
      location,
      metadata: null,
      rawText
    });

    this.mergeDocumentSession(session);
    this.updateShellData({ status: `Created ${location.name}.` });
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  private async saveActiveDocumentAs(): Promise<void> {
    const activeDocument = this.getActiveDocument();

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

    const textToSave = activeDocument.rawText;
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

  private async saveDraftDocument(document: DocumentSession): Promise<void> {
    if (document.location.kind !== "app-draft") {
      return;
    }

    this.autosaveScheduler.clear(document.id);
    await this.dependencies.draftStorage.writeDraft(
      document.location,
      document.rawText
    );
    this.updateShellData({
      documents: this.shellData.documents.map((candidate) =>
        candidate.id === document.id
          ? markDocumentSessionSaved(candidate, {
              fileId: null,
              mtimeMs: Date.now(),
              size: document.rawText.length
            })
          : candidate
      ),
      status: `Draft saved for ${document.location.name}.`
    });
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  private async promoteDraftDocument(document: DocumentSession): Promise<void> {
    if (document.location.kind !== "app-draft") {
      return;
    }

    const result = await dialog.showSaveDialog(this.window, {
      defaultPath: this.getDefaultSaveAsPath(document),
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "Save Markdown File"
    });

    if (result.canceled || !result.filePath) {
      this.emitToRenderer({ type: "status", message: "Save cancelled." });
      return;
    }

    const textToSave = document.rawText;
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
      return;
    }

    await this.dependencies.draftStorage.deleteDraft(document.location);
    const nextSession =
      (await createSessionForFilePath(
        this.dependencies.fileSystem,
        result.filePath
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
  }

  private async renameDocument(documentId: string): Promise<void> {
    const document = this.getDocumentById(documentId);

    if (!document || document.location.kind !== "desktop-path") {
      this.emitToRenderer({
        type: "status",
        message: "Only desktop files can be renamed."
      });
      return;
    }

    const result = await dialog.showSaveDialog(this.window, {
      buttonLabel: "Rename",
      defaultPath: document.location.path,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "Rename Markdown File"
    });

    if (result.canceled || !result.filePath) {
      this.emitToRenderer({ type: "status", message: "Rename cancelled." });
      return;
    }

    const targetPath = result.filePath;

    if (targetPath === document.location.path) {
      this.emitToRenderer({
        type: "status",
        message: "Rename kept the same path."
      });
      return;
    }

    try {
      const existingTarget = await stat(targetPath).catch(() => null);

      if (existingTarget) {
        this.emitToRenderer({
          type: "status",
          message: "Rename cancelled: target file already exists."
        });
        return;
      }

      this.dependencies.selfWritePaths.add(document.location.path);
      this.dependencies.selfWritePaths.add(targetPath);
      await rename(document.location.path, targetPath);
    } catch (error) {
      this.emitToRenderer({
        type: "status",
        message:
          error instanceof Error
            ? `Rename failed: ${error.message}`
            : "Rename failed."
      });
      return;
    } finally {
      this.dependencies.selfWritePaths.delete(document.location.path);
      this.dependencies.selfWritePaths.delete(targetPath);
    }

    const nextSession = await createSessionForFilePath(
      this.dependencies.fileSystem,
      targetPath
    );

    if (!nextSession) {
      this.emitToRenderer({
        type: "status",
        message: "Rename completed, but the renamed file could not be reopened."
      });
      this.closeDocumentSession(document.id);
      await this.refreshWorkspaceEntries();
      this.persistSessionStateSoon();
      this.emitShellSnapshot();
      return;
    }

    const renamedDocument: DocumentSession = {
      ...document,
      id: nextSession.id,
      lastSavedMetadata: nextSession.lastSavedMetadata,
      location: nextSession.location
    };

    this.autosaveScheduler.clear(document.id);
    if (
      this.dependencies.getAutosaveEnabled() &&
      renamedDocument.saveState === "dirty"
    ) {
      this.autosaveScheduler.schedule(renamedDocument.id);
    }

    this.updateShellData({
      activeDocumentId:
        this.shellData.activeDocumentId === document.id
          ? renamedDocument.id
          : this.shellData.activeDocumentId,
      documents: this.shellData.documents.map((candidate) =>
        candidate.id === document.id ? renamedDocument : candidate
      ),
      status: `Renamed ${path.basename(document.location.path)} to ${path.basename(targetPath)}.`
    });
    this.clampEditorModeForActiveDocument();
    this.updateActiveFileWatcher();
    await this.refreshWorkspaceEntries();
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
  }

  private async saveDocument(
    documentId: string,
    trigger: "autosave" | "manual"
  ): Promise<void> {
    const activeDocument = this.shellData.documents.find(
      (document) => document.id === documentId
    );

    if (!activeDocument) {
      return;
    }

    if (activeDocument.saveState === "idle") {
      if (
        trigger === "manual" &&
        activeDocument.location.kind === "app-draft"
      ) {
        await this.promoteDraftDocument(activeDocument);
      }

      return;
    }

    if (
      activeDocument.saveState === "conflict" ||
      activeDocument.saveState === "external-change"
    ) {
      this.emitToRenderer({
        type: "status",
        message: "Resolve the disk conflict before saving."
      });
      return;
    }

    if (activeDocument.location.kind === "app-draft") {
      if (trigger === "autosave") {
        await this.saveDraftDocument(activeDocument);
      } else {
        await this.promoteDraftDocument(activeDocument);
      }

      return;
    }

    if (activeDocument.location.kind !== "desktop-path") {
      this.emitToRenderer({
        type: "status",
        message: "Save is only available for desktop files."
      });
      return;
    }

    this.autosaveScheduler.clear(activeDocument.id);

    const shouldFormatRichSave =
      trigger === "manual" && this.currentMode === "rich";
    const textToSave = shouldFormatRichSave
      ? (await formatMarkdownText(activeDocument.rawText)).markdown
      : activeDocument.rawText;

    if (shouldFormatRichSave) {
      const serialized = serializeMarkdownSession({
        ...activeDocument,
        rawText: textToSave
      });

      if (serialized.fidelityWarnings.length > 0) {
        const fidelityWarning =
          serialized.fidelityWarnings[0] ??
          "Rich-mode save was blocked to avoid losing Markdown fidelity.";

        this.updateShellData({
          documents: this.shellData.documents.map((document) =>
            document.id === activeDocument.id
              ? { ...document, capability: "source-only", mode: "source" }
              : document
          ),
          status: fidelityWarning
        });
        this.currentMode = "source";
        this.emitToRenderer({ type: "mode-changed", mode: this.currentMode });
        this.emitShellSnapshot();
        return;
      }
    }

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

    this.dependencies.selfWritePaths.add(activeDocumentPath);
    const saveResult = await this.dependencies.fileSystem.writeTextAtomic(
      activeDocument.location,
      textToSave,
      {
        expectedMetadata: activeDocument.lastSavedMetadata
      }
    );
    setTimeout(() => {
      this.dependencies.selfWritePaths.delete(activeDocumentPath);
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
      return;
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
      return;
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
  }

  private async reloadActiveDocumentFromDisk(): Promise<void> {
    const activeDocument = this.getActiveDocument();

    if (!activeDocument || activeDocument.location.kind !== "desktop-path") {
      this.emitToRenderer({
        type: "status",
        message: "No desktop file to reload."
      });
      return;
    }

    if (
      shouldProtectDocumentSessionClose(activeDocument) &&
      !(await this.confirmDiscardProtectedDocuments([activeDocument], "reload"))
    ) {
      this.emitToRenderer({ type: "status", message: "Reload cancelled." });
      return;
    }

    const nextSession = await createSessionForFilePath(
      this.dependencies.fileSystem,
      activeDocument.location.path
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
    this.clampEditorModeForActiveDocument();
    this.emitShellSnapshot();
  }

  private async keepEditingActiveDocument(): Promise<void> {
    const activeDocument = this.getActiveDocument();

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

  private showManualCompareStatus(): void {
    const activeDocument = this.getActiveDocument();

    this.emitToRenderer({
      type: "status",
      message:
        activeDocument?.location.kind === "desktop-path"
          ? `File path: ${activeDocument.location.path}`
          : "No desktop file path to show."
    });
  }

  private revealDocumentInWorkspace(document: DocumentSession): void {
    if (
      !this.shellData.workspacePath ||
      document.location.kind !== "desktop-path" ||
      !isPathInsideDirectory(
        this.shellData.workspacePath,
        document.location.path
      )
    ) {
      this.emitToRenderer({
        type: "status",
        message: "This file is not in the active workspace."
      });
      return;
    }

    this.updateShellData({
      activeDocumentId: document.id,
      status: `Revealed ${path.basename(document.location.path)} in workspace.`
    });
    this.updateActiveFileWatcher();
    this.persistSessionStateSoon();
    this.emitShellSnapshot();
    this.emitToRenderer({
      type: "reveal-workspace-file",
      path: document.location.path
    });
  }

  private async openFileFromDialog(): Promise<void> {
    const result = await dialog.showOpenDialog(this.window, {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      this.emitToRenderer({ type: "status", message: "Open file cancelled." });
      return;
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      this.emitToRenderer({
        type: "status",
        message: "Open file did not return a path."
      });
      return;
    }

    await this.openFilePath(selectedPath);
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

  private getWorkspaceFileActions(): WorkspaceFileActions {
    this.workspaceFileActions ??= createWorkspaceFileActions({
      closeDocumentSessions: (documentIds, status) =>
        this.closeDocumentSessions(documentIds, status),
      confirmDiscardDocumentsSequentially: (documents) =>
        this.confirmDiscardDocumentsSequentially(documents),
      emitShellSnapshot: () => this.emitShellSnapshot(),
      emitStatus: (message) => this.emitToRenderer({ type: "status", message }),
      fileSystem: this.dependencies.fileSystem,
      getDocuments: () => this.shellData.documents,
      getMainWindow: () => this.window,
      getWorkspacePath: () => this.shellData.workspacePath,
      openFilePath: (filePath, options) => this.openFilePath(filePath, options),
      openFolderSearch: (folderPath) =>
        this.emitToRenderer({ type: "find-in-folder", path: folderPath }),
      persistSessionStateSoon: () => this.persistSessionStateSoon(),
      refreshWorkspaceEntries: () => this.refreshWorkspaceEntries(),
      selfWritePaths: this.dependencies.selfWritePaths
    });

    return this.workspaceFileActions;
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
