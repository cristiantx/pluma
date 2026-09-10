import type { CommandRequest, CommandIdForRoute } from "@pluma/commands";
import {
  isMarkdownFilePath,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";
import { dialog, type BrowserWindow } from "electron";
import path from "node:path";
import type {
  DesktopShellSnapshot,
  RendererEvent
} from "../../shared/shellState";
import { isPathInsideDirectory } from "./desktopWorkspace";
import {
  createWorkspaceFileActions,
  type WorkspaceFileActions
} from "./workspaceFileActions";
export type WindowWorkspaceActionsDependencies = {
  getShellData(): DesktopShellSnapshot;
  getWindow(): BrowserWindow;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getDefaultLineEnding(): "crlf" | "lf" | "system";
  selfWritePaths: Set<string>;
  clearAutosave(): void;
  emitToRenderer(event: RendererEvent): void;
  emitStatus(message: string): void;
  emitShellSnapshot(): void;
  getProtectedDocuments(): DocumentSession[];
  resolveProtectedDocumentClose(
    documents: DocumentSession[],
    reason: "switch-workspace"
  ): Promise<boolean>;
  closeDocumentSessions(ids: string[], status: string): void;
  updateShellData(
    update: Partial<Omit<DesktopShellSnapshot, "editorMode">>
  ): void;
  syncEditorModeForActiveDocument(): void;
  updateActiveFileWatcher(): void;
  updateWorkspaceWatcher(): void;
  invalidateRestoration(): void;
  persistSessionStateSoon(): void;
  refreshWorkspaceEntries(): Promise<void>;
  confirmDiscardDocumentsSequentially(
    documents: DocumentSession[]
  ): Promise<boolean>;
  openFilePath(
    path: string,
    options?: { workspacePath?: string | null }
  ): Promise<void>;
  handleContextCommand(
    request: Extract<
      CommandRequest,
      { id: CommandIdForRoute<"tab" | "workspace"> }
    >,
    native: boolean
  ): Promise<void>;
};
export function createWindowWorkspaceActions(
  dependencies: WindowWorkspaceActionsDependencies
) {
  let workspaceFileActions: WorkspaceFileActions | null = null;
  async function openWorkspaceFile(filePath: unknown): Promise<void> {
    const workspacePath = dependencies.getShellData().workspacePath;
    if (
      typeof filePath !== "string" ||
      !workspacePath ||
      !isMarkdownFilePath(filePath) ||
      !isPathInsideDirectory(workspacePath, filePath)
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Workspace file open was ignored."
      });
      return;
    }

    await dependencies.openFilePath(filePath, {
      workspacePath: dependencies.getShellData().workspacePath
    });
  }

  async function openFolderPath(directoryPath: string): Promise<void> {
    if (directoryPath === dependencies.getShellData().workspacePath) {
      dependencies.emitToRenderer({
        type: "status",
        message: `Workspace ${path.basename(directoryPath)} is already open.`
      });
      return;
    }

    const protectedDocuments = dependencies.getProtectedDocuments();

    if (
      protectedDocuments.length > 0 &&
      !(await dependencies.resolveProtectedDocumentClose(
        protectedDocuments,
        "switch-workspace"
      ))
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Workspace switch cancelled."
      });
      dependencies.emitShellSnapshot();
      return;
    }

    dependencies.invalidateRestoration();
    dependencies.closeDocumentSessions(
      dependencies.getShellData().documents.map((document) => document.id),
      "Closed documents for workspace switch."
    );

    dependencies.updateShellData({
      activeDocumentId: null,
      activeTabId: null,
      documents: [],
      status: `Opened workspace ${path.basename(directoryPath)}.`,
      workspaceEntries: [],
      workspacePath: directoryPath
    });
    dependencies.syncEditorModeForActiveDocument();
    dependencies.clearAutosave();
    dependencies.updateActiveFileWatcher();
    dependencies.updateWorkspaceWatcher();
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
    await dependencies.refreshWorkspaceEntries();
  }

  async function openFolderFromDialog(): Promise<void> {
    const result = await dialog.showOpenDialog(dependencies.getWindow(), {
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Open folder cancelled."
      });
      return;
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Open folder did not return a path."
      });
      return;
    }

    await openFolderPath(selectedPath);
  }

  function isValidWorkspaceTarget(
    targetPath: string,
    kind: "file" | "folder"
  ): boolean {
    const workspacePath = dependencies.getShellData().workspacePath;

    if (!workspacePath) {
      return false;
    }

    if (targetPath === workspacePath) {
      return kind === "folder";
    }

    return (
      isPathInsideDirectory(workspacePath, targetPath) &&
      dependencies
        .getShellData()
        .workspaceEntries.some(
          (entry) => entry.path === targetPath && entry.kind === kind
        )
    );
  }

  function getWorkspaceFileActions(): WorkspaceFileActions {
    workspaceFileActions ??= createWorkspaceFileActions({
      onCommand: (request) => {
        void dependencies
          .handleContextCommand(request, true)
          .catch((error: unknown) => dependencies.emitStatus(String(error)));
      },
      closeDocumentSessions: (documentIds, status) =>
        dependencies.closeDocumentSessions(documentIds, status),
      confirmDiscardDocumentsSequentially: (documents) =>
        dependencies.confirmDiscardDocumentsSequentially(documents),
      emitShellSnapshot: () => dependencies.emitShellSnapshot(),
      emitStatus: (message) =>
        dependencies.emitToRenderer({ type: "status", message }),
      fileSystem: dependencies.fileSystem,
      getDocuments: () => dependencies.getShellData().documents,
      getDefaultLineEnding: () => dependencies.getDefaultLineEnding(),
      getMainWindow: () => dependencies.getWindow(),
      getWorkspacePath: () => dependencies.getShellData().workspacePath,
      openFilePath: (filePath, options) =>
        dependencies.openFilePath(filePath, options),
      openFolderSearch: (folderPath) =>
        dependencies.emitToRenderer({
          type: "find-in-folder",
          path: folderPath
        }),
      persistSessionStateSoon: () => dependencies.persistSessionStateSoon(),
      refreshWorkspaceEntries: () => dependencies.refreshWorkspaceEntries(),
      selfWritePaths: dependencies.selfWritePaths
    });

    return workspaceFileActions;
  }
  return {
    openWorkspaceFile,
    openFolderPath,
    openFolderFromDialog,
    isValidWorkspaceTarget,
    getWorkspaceFileActions
  };
}
