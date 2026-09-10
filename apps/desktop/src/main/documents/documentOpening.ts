import { dialog, type BrowserWindow } from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";

import {
  applyLineEnding,
  createDocumentSession,
  detectLineEnding,
  getFileLocationName,
  isMarkdownFilePath,
  resolveDefaultLineEnding,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import type {
  DesktopShellSnapshot,
  EditorViewMode,
  RendererEvent,
  WorkspaceTreeEntry
} from "../../shared/shellState";
import type { AppDraftStorage } from "../persistence/appDraftStorage";
import {
  createSessionForFilePath,
  isPathInsideDirectory,
  type MarkdownModeAnalyzer
} from "../workspace/desktopWorkspace";

export type DocumentOpeningDependencies = {
  analyzeMarkdownMode: MarkdownModeAnalyzer;
  appDocumentsPath: string;
  draftStorage: AppDraftStorage;
  emitShellSnapshot: () => void;
  emitToRenderer: (event: RendererEvent) => void;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getCurrentMode: () => EditorViewMode;
  getDefaultLineEnding: () => "crlf" | "lf" | "system";
  getDocumentByDesktopPath: (filePath: string) => DocumentSession | null;
  getDocuments: () => DocumentSession[];
  getWorkspaceEntries: () => WorkspaceTreeEntry[];
  getWorkspacePath: () => string | null;
  mergeDocumentSession: (document: DocumentSession) => void;
  openFolderPath: (directoryPath: string) => Promise<void>;
  persistSessionStateSoon: () => void;
  syncEditorModeForActiveDocument: () => void;
  updateActiveFileWatcher: () => void;
  updateShellData: (update: Partial<DesktopShellSnapshot>) => void;
  updateWorkspaceWatcher: () => void;
  window: BrowserWindow;
};

export function createDocumentOpening(
  dependencies: DocumentOpeningDependencies
) {
  function getDefaultNewFilePath(): string {
    return path.join(
      dependencies.getWorkspacePath() ?? dependencies.appDocumentsPath,
      "Untitled.md"
    );
  }

  function getDefaultSaveAsPath(document: DocumentSession): string {
    if (document.location.kind === "app-draft") {
      return path.join(
        dependencies.getWorkspacePath() ?? dependencies.appDocumentsPath,
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

    return getDefaultNewFilePath();
  }

  function getNextDraftName(): string {
    const usedNames = new Set(
      dependencies
        .getDocuments()
        .filter((document) => document.location.kind === "app-draft")
        .map((document) => getFileLocationName(document.location))
    );
    let index = 1;

    while (usedNames.has(`Untitled-${index}`)) {
      index += 1;
    }

    return `Untitled-${index}`;
  }

  async function openFilePath(
    filePath: string,
    options: { workspacePath?: string | null } = {}
  ): Promise<void> {
    const openDocument = dependencies.getDocumentByDesktopPath(filePath);

    if (openDocument) {
      dependencies.updateShellData({
        activeDocumentId: openDocument.id,
        activeTabId: openDocument.id,
        status: `Switched to ${path.basename(filePath)}.`
      });
      dependencies.syncEditorModeForActiveDocument();
      dependencies.updateActiveFileWatcher();
      dependencies.persistSessionStateSoon();
      dependencies.emitShellSnapshot();
      return;
    }

    const session = await createSessionForFilePath(
      dependencies.fileSystem,
      filePath,
      dependencies.analyzeMarkdownMode
    );

    if (!session) {
      dependencies.emitToRenderer({
        type: "status",
        message: `Could not read metadata for "${filePath}".`
      });
      return;
    }

    const currentWorkspacePath = dependencies.getWorkspacePath();
    const workspacePath =
      options.workspacePath ??
      (currentWorkspacePath &&
      isPathInsideDirectory(currentWorkspacePath, filePath)
        ? currentWorkspacePath
        : null);

    dependencies.mergeDocumentSession(session);
    dependencies.updateShellData({
      status: `Opened ${path.basename(filePath)}.`,
      workspaceEntries: workspacePath ? dependencies.getWorkspaceEntries() : [],
      workspacePath
    });
    dependencies.updateWorkspaceWatcher();
    dependencies.emitToRenderer({
      type: "mode-changed",
      mode: dependencies.getCurrentMode()
    });
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
  }

  async function handleOpenTarget(targetPath: string): Promise<void> {
    try {
      const targetStats = await stat(targetPath);

      if (targetStats.isDirectory()) {
        await dependencies.openFolderPath(targetPath);
        return;
      }

      if (targetStats.isFile() && isMarkdownFilePath(targetPath)) {
        await openFilePath(targetPath);
      }
    } catch (error) {
      dependencies.emitToRenderer({
        type: "status",
        message:
          error instanceof Error
            ? error.message
            : `Failed to open "${targetPath}".`
      });
    }
  }

  async function createNewMarkdownFile(): Promise<void> {
    const rawText = applyLineEnding(
      "# Untitled\n",
      resolveDefaultLineEnding(
        dependencies.getDefaultLineEnding(),
        process.platform
      )
    );
    const location = await dependencies.draftStorage.createDraft(
      getNextDraftName(),
      rawText
    );
    const session = createDocumentSession({
      location,
      lineEnding: detectLineEnding(rawText),
      metadata: null,
      rawText
    });

    dependencies.mergeDocumentSession(session);
    dependencies.updateShellData({ status: `Created ${location.name}.` });
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
  }

  async function openFileFromDialog(): Promise<void> {
    const result = await dialog.showOpenDialog(dependencies.window, {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Open file cancelled."
      });
      return;
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Open file did not return a path."
      });
      return;
    }

    await openFilePath(selectedPath);
  }

  return {
    createNewMarkdownFile,
    getDefaultNewFilePath,
    getDefaultSaveAsPath,
    getNextDraftName,
    handleOpenTarget,
    openFileFromDialog,
    openFilePath
  };
}
