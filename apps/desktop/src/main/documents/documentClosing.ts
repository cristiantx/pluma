import {
  commandExecuted,
  commandCancelled,
  type CommandExecutionResult
} from "@pluma/commands";
import {
  shouldProtectDocumentSessionClose,
  type DocumentSession
} from "@pluma/core";
import type { BrowserWindow } from "electron";

import type { RendererEvent } from "../../shared/shellState";
import {
  chooseProtectedDocumentCloseAction,
  confirmDiscardDocumentsSequentially as confirmDiscardDocumentsSequentiallyDialog,
  confirmDiscardProtectedDocuments as confirmDiscardProtectedDocumentsDialog,
  confirmReloadConflictedDocument as confirmReloadConflictedDocumentDialog,
  type ProtectedDocumentAction
} from "../dialogs/documentProtection";

type CloseDocumentsOptions = { clearSettingsTab?: boolean };
type DiscardProtectedDocumentAction = Extract<
  ProtectedDocumentAction,
  "close-tab" | "quit" | "reload"
>;
type ResolveProtectedDocumentAction = Extract<
  ProtectedDocumentAction,
  "close-tab" | "quit" | "switch-workspace"
>;

export type DocumentClosingDependencies = {
  window: BrowserWindow;
  getActiveDocumentForActiveTab: () => DocumentSession | null;
  getDocumentById: (documentId: string) => DocumentSession | null;
  getProtectedDocuments: () => DocumentSession[];
  getCurrentDocumentIdForClose: (document: DocumentSession) => string;
  closeDocumentSession: (documentId: string) => void;
  closeDocumentSessionsWithOptions: (
    documentIds: string[],
    status: string,
    options?: CloseDocumentsOptions
  ) => void;
  saveDocument: (
    documentId: string,
    trigger: "autosave" | "manual"
  ) => Promise<boolean>;
  emitToRenderer: (event: RendererEvent) => void;
  emitShellSnapshot: () => void;
  persistSessionStateSoon: () => void;
};

export function createDocumentClosing(
  dependencies: DocumentClosingDependencies
) {
  async function closeTab(tabId: string): Promise<void> {
    const document = dependencies.getDocumentById(tabId);

    if (
      document &&
      shouldProtectDocumentSessionClose(document) &&
      !(await resolveProtectedDocumentClose([document], "close-tab"))
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Close tab cancelled."
      });
      dependencies.emitShellSnapshot();
      return;
    }

    dependencies.closeDocumentSession(
      document ? dependencies.getCurrentDocumentIdForClose(document) : tabId
    );
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
  }

  async function closeWindowWithProtection(): Promise<boolean> {
    const protectedDocuments = dependencies.getProtectedDocuments();

    if (protectedDocuments.length === 0) {
      return true;
    }

    const canClose = await resolveProtectedDocumentClose(
      protectedDocuments,
      "quit"
    );

    if (!canClose) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Quit cancelled."
      });
    }

    return canClose;
  }

  async function closeActiveDocumentSession(): Promise<CommandExecutionResult> {
    const activeDocument = dependencies.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      dependencies.emitToRenderer({
        type: "status",
        message: "No active document to close."
      });
      return commandCancelled;
    }

    if (
      shouldProtectDocumentSessionClose(activeDocument) &&
      !(await resolveProtectedDocumentClose([activeDocument], "close-tab"))
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Close tab cancelled."
      });
      dependencies.emitShellSnapshot();
      return commandCancelled;
    }

    dependencies.closeDocumentSession(
      dependencies.getCurrentDocumentIdForClose(activeDocument)
    );
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
    return commandExecuted;
  }

  async function closeDocumentsWithProtection(
    documents: DocumentSession[],
    status: string,
    options: CloseDocumentsOptions = {}
  ): Promise<boolean> {
    if (documents.length === 0) {
      dependencies.emitToRenderer({
        type: "status",
        message: "No tabs to close."
      });
      return true;
    }

    const protectedDocuments = documents.filter(
      shouldProtectDocumentSessionClose
    );

    if (!(await resolveProtectedDocumentsSequentially(protectedDocuments))) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Close tab cancelled."
      });
      dependencies.emitShellSnapshot();
      return false;
    }

    dependencies.closeDocumentSessionsWithOptions(
      documents.map((document) =>
        dependencies.getCurrentDocumentIdForClose(document)
      ),
      status,
      options
    );
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
    return true;
  }

  async function closeDocumentsAndMaybeSettings(
    documents: DocumentSession[],
    shouldCloseSettings: boolean,
    status: string
  ): Promise<void> {
    const didCloseDocuments =
      documents.length === 0
        ? true
        : await closeDocumentsWithProtection(documents, status, {
            clearSettingsTab: shouldCloseSettings
          });

    if (didCloseDocuments && shouldCloseSettings) {
      emitCloseSettingsTab();
    }
  }

  function emitCloseSettingsTab(): void {
    dependencies.emitToRenderer({ type: "close-settings-tab" });
  }

  async function confirmDiscardProtectedDocuments(
    documents: DocumentSession[],
    action: DiscardProtectedDocumentAction
  ): Promise<boolean> {
    return confirmDiscardProtectedDocumentsDialog(
      dependencies.window,
      documents,
      action
    );
  }

  async function confirmReloadConflictedDocument(): Promise<boolean> {
    return confirmReloadConflictedDocumentDialog(dependencies.window);
  }

  async function confirmDiscardDocumentsSequentially(
    documents: DocumentSession[]
  ): Promise<boolean> {
    return confirmDiscardDocumentsSequentiallyDialog(
      dependencies.window,
      documents
    );
  }

  async function resolveProtectedDocumentClose(
    documents: DocumentSession[],
    action: ResolveProtectedDocumentAction
  ): Promise<boolean> {
    const choice = await chooseProtectedDocumentCloseAction(
      dependencies.window,
      documents,
      action
    );

    if (choice === "discard") {
      return true;
    }

    if (choice === "cancel") {
      return false;
    }

    return saveDocumentsBeforeClose(documents);
  }

  async function resolveProtectedDocumentsSequentially(
    documents: DocumentSession[]
  ): Promise<boolean> {
    for (const document of documents) {
      if (!(await resolveProtectedDocumentClose([document], "close-tab"))) {
        return false;
      }
    }

    return true;
  }

  async function saveDocumentsBeforeClose(
    documents: DocumentSession[]
  ): Promise<boolean> {
    for (const document of documents) {
      if (!(await dependencies.saveDocument(document.id, "manual"))) {
        return false;
      }
    }

    return true;
  }

  return {
    closeActiveDocumentSession,
    closeDocumentsAndMaybeSettings,
    closeDocumentsWithProtection,
    closeTab,
    closeWindowWithProtection,
    confirmDiscardDocumentsSequentially,
    confirmDiscardProtectedDocuments,
    confirmReloadConflictedDocument,
    emitCloseSettingsTab,
    resolveProtectedDocumentClose,
    resolveProtectedDocumentsSequentially,
    saveDocumentsBeforeClose
  };
}
