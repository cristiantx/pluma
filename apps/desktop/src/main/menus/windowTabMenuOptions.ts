import type { DocumentSession } from "@pluma/core";

import { isPathInsideDirectory } from "../workspace/desktopWorkspace";
import type {
  TabContextMenuOptions,
  TabMenuCommandRequest
} from "./tabContextMenu";

export type WindowTabMenuOptionsDependencies = {
  closeDocumentsAndMaybeSettings: (
    documents: DocumentSession[],
    closeSettings: boolean,
    status: string
  ) => Promise<void>;
  closeDocumentsWithProtection: (
    documents: DocumentSession[],
    status: string
  ) => Promise<boolean>;
  copyDocumentPath: (documentId: string) => void | Promise<unknown>;
  emitCloseSettingsTab: () => void;
  emitStatus: (message: string) => void;
  getDocumentById: (documentId: string) => DocumentSession | null;
  getDocuments: () => DocumentSession[];
  getWorkspacePath: () => string | null;
  handleContextCommand: (
    request: TabMenuCommandRequest,
    targetWasValidated: true
  ) => Promise<void>;
  renameDocument: (documentId: string) => void | Promise<unknown>;
  revealDocumentInWorkspace: (
    document: DocumentSession
  ) => void | Promise<unknown>;
  showDocumentInFolder: (documentId: string) => void | Promise<unknown>;
};

export type WindowTabMenuOptions = {
  getSettingsTabContextMenuOptions: (
    openTabIds: string[]
  ) => TabContextMenuOptions;
  getTabContextMenuOptions: (
    tabId: string,
    tabIds: unknown
  ) => TabContextMenuOptions | null;
};

export function createWindowTabMenuOptions(
  dependencies: WindowTabMenuOptionsDependencies
): WindowTabMenuOptions {
  const onCommand = (request: TabMenuCommandRequest): void => {
    void dependencies
      .handleContextCommand(request, true)
      .catch((error: unknown) => dependencies.emitStatus(String(error)));
  };

  function getSettingsTabContextMenuOptions(
    openTabIds: string[]
  ): TabContextMenuOptions {
    const documents = dependencies.getDocuments();
    const savedDocuments = documents.filter(
      (candidate) => candidate.saveState === "idle"
    );

    return {
      target: { tabId: "settings", tabIds: openTabIds },
      onCommand,
      canCloseAll: openTabIds.length > 0,
      canCloseOthers: documents.length > 0,
      canCloseSavedTabs: savedDocuments.length > 0,
      canCopyPath: false,
      canRename: false,
      canRevealInWorkspace: false,
      canShowInFolder: false,
      includeFileActions: false,
      onClose: () => dependencies.emitCloseSettingsTab(),
      onCloseOthers: () =>
        dependencies.closeDocumentsWithProtection(
          dependencies.getDocuments(),
          "Closed other document tabs."
        ),
      onCloseSavedTabs: () =>
        dependencies.closeDocumentsWithProtection(
          savedDocuments,
          "Closed saved document tabs."
        ),
      onCloseAll: () =>
        dependencies.closeDocumentsAndMaybeSettings(
          dependencies.getDocuments(),
          true,
          "Closed all tabs."
        ),
      onCopyPath: () => undefined,
      onRename: () => undefined,
      onRevealInWorkspace: () => undefined,
      onShowInFolder: () => undefined
    };
  }

  function getTabContextMenuOptions(
    tabId: string,
    tabIds: unknown
  ): TabContextMenuOptions | null {
    const openTabIds = Array.isArray(tabIds)
      ? tabIds.filter((candidate) => typeof candidate === "string")
      : [];
    const hasSettingsTab = openTabIds.includes("settings");

    if (tabId === "settings") {
      return getSettingsTabContextMenuOptions(openTabIds);
    }

    const document = dependencies.getDocumentById(tabId);
    if (!document) {
      return null;
    }

    const documents = dependencies.getDocuments();
    const otherDocuments = documents.filter(
      (candidate) => candidate.id !== document.id
    );
    const savedDocuments = documents.filter(
      (candidate) => candidate.saveState === "idle"
    );
    const hasDesktopPath = document.location.kind === "desktop-path";
    const workspacePath = dependencies.getWorkspacePath();
    const canRevealInWorkspace =
      workspacePath !== null &&
      document.location.kind === "desktop-path" &&
      isPathInsideDirectory(workspacePath, document.location.path);

    return {
      target: { tabId, tabIds: openTabIds },
      onCommand,
      canCloseAll: documents.length > 0 || hasSettingsTab,
      canCloseOthers: otherDocuments.length > 0 || hasSettingsTab,
      canCloseSavedTabs: savedDocuments.length > 0,
      canCopyPath: hasDesktopPath,
      canRename: hasDesktopPath,
      canRevealInWorkspace,
      canShowInFolder: hasDesktopPath,
      onClose: () =>
        dependencies.closeDocumentsWithProtection(
          [document],
          "Closed document tab."
        ),
      onCloseOthers: () =>
        dependencies.closeDocumentsAndMaybeSettings(
          otherDocuments,
          hasSettingsTab,
          "Closed other tabs."
        ),
      onCloseSavedTabs: () =>
        dependencies.closeDocumentsWithProtection(
          savedDocuments,
          "Closed saved document tabs."
        ),
      onCloseAll: () =>
        dependencies.closeDocumentsAndMaybeSettings(
          dependencies.getDocuments(),
          hasSettingsTab,
          "Closed all tabs."
        ),
      onRename: () => dependencies.renameDocument(document.id),
      onCopyPath: () => dependencies.copyDocumentPath(document.id),
      onShowInFolder: () => dependencies.showDocumentInFolder(document.id),
      onRevealInWorkspace: () =>
        dependencies.revealDocumentInWorkspace(document)
    };
  }

  return { getSettingsTabContextMenuOptions, getTabContextMenuOptions };
}
