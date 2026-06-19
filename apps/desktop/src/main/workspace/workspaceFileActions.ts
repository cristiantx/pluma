import { clipboard, dialog, shell, type BrowserWindow } from "electron";
import { copyFile, cp, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import {
  shouldProtectDocumentSessionClose,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import { buildWorkspaceContextMenu } from "../menus/workspaceContextMenu";
import {
  clearWorkspaceClipboard,
  getWorkspaceClipboard,
  hasWorkspaceClipboard,
  setWorkspaceClipboard,
  type WorkspaceItemKind
} from "./workspaceClipboard";
import {
  getDocumentsInWorkspacePath,
  getWorkspaceTargetDirectory
} from "./workspacePathHelpers";

export type WorkspaceFileActions = {
  copyDocumentPath: (documentId: string) => void;
  showDocumentInFolder: (documentId: string) => void;
  showWorkspaceContextMenu: (
    targetPath: string,
    kind: WorkspaceItemKind
  ) => void;
};

export type WorkspaceFileActionDependencies = {
  closeDocumentSessions: (documentIds: string[], status: string) => void;
  confirmDiscardDocumentsSequentially: (
    documents: DocumentSession[]
  ) => Promise<boolean>;
  emitShellSnapshot: () => void;
  emitStatus: (message: string) => void;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getDocuments: () => DocumentSession[];
  getMainWindow: () => BrowserWindow | null;
  getWorkspacePath: () => string | null;
  openFilePath: (
    filePath: string,
    options?: { workspacePath?: string | null }
  ) => Promise<void>;
  openFolderSearch: (folderPath: string) => void;
  persistSessionStateSoon: () => void;
  refreshWorkspaceEntries: () => Promise<void>;
  selfWritePaths: Set<string>;
};

export function createWorkspaceFileActions(
  dependencies: WorkspaceFileActionDependencies
): WorkspaceFileActions {
  function getDocumentById(documentId: string): DocumentSession | null {
    return (
      dependencies
        .getDocuments()
        .find((document) => document.id === documentId) ?? null
    );
  }

  function copyDocumentPath(documentId: string): void {
    const document = getDocumentById(documentId);

    if (!document || document.location.kind !== "desktop-path") {
      dependencies.emitStatus("No file path to copy.");
      return;
    }

    clipboard.writeText(document.location.path);
    dependencies.emitStatus("Copied file path.");
  }

  function showDocumentInFolder(documentId: string): void {
    const document = getDocumentById(documentId);

    if (!document || document.location.kind !== "desktop-path") {
      dependencies.emitStatus("No file to show in folder.");
      return;
    }

    shell.showItemInFolder(document.location.path);
    dependencies.emitStatus("Showing file in folder.");
  }

  async function createWorkspaceFile(
    targetPath: string,
    kind: WorkspaceItemKind
  ): Promise<void> {
    const mainWindow = dependencies.getMainWindow();

    if (!mainWindow) {
      return;
    }

    const targetDirectory = getWorkspaceTargetDirectory(targetPath, kind);
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(targetDirectory, "Untitled.md"),
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      title: "New Markdown File"
    });

    if (result.canceled || !result.filePath) {
      dependencies.emitStatus("New file cancelled.");
      return;
    }

    const writeResult = await dependencies.fileSystem.writeTextAtomic(
      { kind: "desktop-path", path: result.filePath },
      "# Untitled\n"
    );

    if (writeResult.kind !== "success") {
      dependencies.emitStatus(
        writeResult.kind === "conflict"
          ? `New file conflict: file was ${writeResult.reason}.`
          : `New file failed: ${writeResult.message}`
      );
      return;
    }

    await dependencies.openFilePath(result.filePath, {
      workspacePath: dependencies.getWorkspacePath()
    });
    await dependencies.refreshWorkspaceEntries();
  }

  async function createWorkspaceDirectory(
    targetPath: string,
    kind: WorkspaceItemKind
  ): Promise<void> {
    const mainWindow = dependencies.getMainWindow();

    if (!mainWindow) {
      return;
    }

    const targetDirectory = getWorkspaceTargetDirectory(targetPath, kind);
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(targetDirectory, "New Folder"),
      title: "New Directory"
    });

    if (result.canceled || !result.filePath) {
      dependencies.emitStatus("New directory cancelled.");
      return;
    }

    try {
      await mkdir(result.filePath);
    } catch (error) {
      dependencies.emitStatus(
        error instanceof Error
          ? `New directory failed: ${error.message}`
          : "New directory failed."
      );
      return;
    }

    await dependencies.refreshWorkspaceEntries();
    dependencies.emitStatus(
      `Created directory ${path.basename(result.filePath)}.`
    );
  }

  async function renameWorkspaceItem(
    targetPath: string,
    kind: WorkspaceItemKind
  ): Promise<void> {
    const mainWindow = dependencies.getMainWindow();

    if (!mainWindow) {
      return;
    }

    const openDocuments = getDocumentsInWorkspacePath(
      dependencies.getDocuments(),
      targetPath,
      kind
    );

    if (
      !(await confirmProtectedWorkspaceDocuments(
        openDocuments,
        "Rename cancelled."
      ))
    ) {
      return;
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      buttonLabel: "Rename",
      defaultPath: targetPath,
      title: kind === "folder" ? "Rename Directory" : "Rename File"
    });

    if (result.canceled || !result.filePath) {
      dependencies.emitStatus("Rename cancelled.");
      return;
    }

    if (result.filePath === targetPath) {
      dependencies.emitStatus("Rename kept the same path.");
      return;
    }

    try {
      const existingTarget = await stat(result.filePath).catch(() => null);

      if (existingTarget) {
        dependencies.emitStatus("Rename cancelled: target already exists.");
        return;
      }

      dependencies.selfWritePaths.add(targetPath);
      dependencies.selfWritePaths.add(result.filePath);
      await rename(targetPath, result.filePath);
    } catch (error) {
      dependencies.emitStatus(
        error instanceof Error
          ? `Rename failed: ${error.message}`
          : "Rename failed."
      );
      return;
    } finally {
      dependencies.selfWritePaths.delete(targetPath);
      dependencies.selfWritePaths.delete(result.filePath);
    }

    if (openDocuments.length > 0) {
      dependencies.closeDocumentSessions(
        openDocuments.map((document) => document.id),
        "Closed renamed document tabs."
      );
    }

    await finalizeWorkspaceMutation();
  }

  async function pasteWorkspaceItem(
    targetPath: string,
    kind: WorkspaceItemKind
  ): Promise<void> {
    const source = getWorkspaceClipboard();

    if (!source) {
      dependencies.emitStatus("Nothing to paste.");
      return;
    }

    const targetDirectory = getWorkspaceTargetDirectory(targetPath, kind);
    const destinationPath = path.join(
      targetDirectory,
      path.basename(source.path)
    );

    if (destinationPath === source.path) {
      dependencies.emitStatus(
        "Paste cancelled: source and destination are the same."
      );
      return;
    }

    try {
      const existingTarget = await stat(destinationPath).catch(() => null);

      if (existingTarget) {
        dependencies.emitStatus("Paste cancelled: target already exists.");
        return;
      }

      if (source.operation === "copy") {
        if (source.kind === "folder") {
          await cp(source.path, destinationPath, { recursive: true });
        } else {
          await copyFile(source.path, destinationPath);
        }
      } else {
        const openDocuments = getDocumentsInWorkspacePath(
          dependencies.getDocuments(),
          source.path,
          source.kind
        );

        if (
          !(await confirmProtectedWorkspaceDocuments(
            openDocuments,
            "Paste cancelled."
          ))
        ) {
          return;
        }

        dependencies.selfWritePaths.add(source.path);
        dependencies.selfWritePaths.add(destinationPath);
        await rename(source.path, destinationPath);
        clearWorkspaceClipboard();

        if (openDocuments.length > 0) {
          dependencies.closeDocumentSessions(
            openDocuments.map((document) => document.id),
            "Closed moved document tabs."
          );
        }
      }
    } catch (error) {
      dependencies.emitStatus(
        error instanceof Error
          ? `Paste failed: ${error.message}`
          : "Paste failed."
      );
      return;
    } finally {
      dependencies.selfWritePaths.delete(source.path);
      dependencies.selfWritePaths.delete(destinationPath);
    }

    await finalizeWorkspaceMutation();
  }

  async function moveWorkspaceItemToTrash(
    targetPath: string,
    kind: WorkspaceItemKind
  ): Promise<void> {
    const openDocuments = getDocumentsInWorkspacePath(
      dependencies.getDocuments(),
      targetPath,
      kind
    );

    if (
      !(await confirmProtectedWorkspaceDocuments(
        openDocuments,
        "Move to Trash cancelled."
      ))
    ) {
      return;
    }

    try {
      dependencies.selfWritePaths.add(targetPath);
      await shell.trashItem(targetPath);
    } catch (error) {
      dependencies.emitStatus(
        error instanceof Error
          ? `Move to Trash failed: ${error.message}`
          : "Move to Trash failed."
      );
      return;
    } finally {
      dependencies.selfWritePaths.delete(targetPath);
    }

    if (openDocuments.length > 0) {
      dependencies.closeDocumentSessions(
        openDocuments.map((document) => document.id),
        "Closed trashed document tabs."
      );
    }

    await finalizeWorkspaceMutation();
  }

  async function confirmProtectedWorkspaceDocuments(
    documents: DocumentSession[],
    cancelledStatus: string
  ): Promise<boolean> {
    const protectedDocuments = documents.filter(
      shouldProtectDocumentSessionClose
    );

    if (
      protectedDocuments.length > 0 &&
      !(await dependencies.confirmDiscardDocumentsSequentially(
        protectedDocuments
      ))
    ) {
      dependencies.emitStatus(cancelledStatus);
      dependencies.emitShellSnapshot();
      return false;
    }

    return true;
  }

  async function finalizeWorkspaceMutation(): Promise<void> {
    await dependencies.refreshWorkspaceEntries();
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
  }

  function showWorkspaceContextMenu(
    targetPath: string,
    kind: WorkspaceItemKind
  ): void {
    const mainWindow = dependencies.getMainWindow();

    if (!mainWindow) {
      return;
    }

    const menu = buildWorkspaceContextMenu({
      canFindInFolder: kind === "folder",
      canPaste: hasWorkspaceClipboard(),
      onNewFile: () => void createWorkspaceFile(targetPath, kind),
      onNewDirectory: () => void createWorkspaceDirectory(targetPath, kind),
      onCopy: () => {
        setWorkspaceClipboard({ operation: "copy", path: targetPath, kind });
        dependencies.emitStatus("Copied workspace item.");
      },
      onCut: () => {
        setWorkspaceClipboard({ operation: "cut", path: targetPath, kind });
        dependencies.emitStatus("Cut workspace item.");
      },
      onPaste: () => void pasteWorkspaceItem(targetPath, kind),
      onRename: () => void renameWorkspaceItem(targetPath, kind),
      onMoveToTrash: () => void moveWorkspaceItemToTrash(targetPath, kind),
      onFindInFolder: () => {
        dependencies.openFolderSearch(targetPath);
      },
      onShowInFolder: () => {
        shell.showItemInFolder(targetPath);
        dependencies.emitStatus("Showing item in folder.");
      }
    });

    menu.popup({ window: mainWindow });
  }

  return {
    copyDocumentPath,
    showDocumentInFolder,
    showWorkspaceContextMenu
  };
}
