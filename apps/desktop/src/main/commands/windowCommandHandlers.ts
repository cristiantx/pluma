import { commandExecuted, type CommandExecutionResult } from "@pluma/commands";
import type { CommandName, RendererEvent } from "../../shared/shellState";

export type WindowCommandHandlerDependencies = {
  closeActiveDocumentSession: () => Promise<void | CommandExecutionResult>;
  createNewMarkdownFile: () => Promise<void | CommandExecutionResult>;
  emitToRenderer: (event: RendererEvent) => void;
  exportActiveDocument: (
    format: "html" | "pdf"
  ) => Promise<void | CommandExecutionResult>;
  getNextEditorMode: () => "source" | "rich" | "preview";
  isDevelopment: boolean;
  keepEditingActiveDocument: () => Promise<void | CommandExecutionResult>;
  openDevTools: () => void;
  openFileFromDialog: () => Promise<void | CommandExecutionResult>;
  openFolderFromDialog: () => Promise<void | CommandExecutionResult>;
  persistSessionStateSoon: () => void;
  reloadActiveDocumentFromDisk: () => Promise<void | CommandExecutionResult>;
  saveActiveDocument: () => Promise<void | CommandExecutionResult>;
  saveActiveDocumentAs: () => Promise<void | CommandExecutionResult>;
  setActiveTab: (tabId: "settings") => void;
  setModeForActiveDocument: (mode: "source" | "rich" | "preview") => void;
};

export type WindowCommandHandlers = {
  handleCommand: (
    command: CommandName
  ) => Promise<void | CommandExecutionResult>;
};

export function createWindowCommandHandlers(
  dependencies: WindowCommandHandlerDependencies
): WindowCommandHandlers {
  async function handleCommand(
    command: CommandName
  ): Promise<void | CommandExecutionResult> {
    switch (command) {
      case "quick-open":
      case "command-palette":
        dependencies.emitToRenderer({
          type: "quick-access-request",
          mode: command === "quick-open" ? "files" : "commands"
        });
        return commandExecuted;
      case "close-active-tab":
        return (
          (await dependencies.closeActiveDocumentSession()) ?? commandExecuted
        );
      case "find":
      case "find-next":
      case "find-previous":
      case "replace":
        dependencies.emitToRenderer({ type: "editor-command", command });
        return commandExecuted;
      case "export-html":
        return (
          (await dependencies.exportActiveDocument("html")) ?? commandExecuted
        );
      case "export-pdf":
        return (
          (await dependencies.exportActiveDocument("pdf")) ?? commandExecuted
        );
      case "keep-editing":
        return (
          (await dependencies.keepEditingActiveDocument()) ?? commandExecuted
        );
      case "new-file":
        return (await dependencies.createNewMarkdownFile()) ?? commandExecuted;
      case "new-window":
      case "reload-window":
      case "force-reload-window":
        return commandExecuted;
      case "open-file":
        return (await dependencies.openFileFromDialog()) ?? commandExecuted;
      case "open-folder":
        return (await dependencies.openFolderFromDialog()) ?? commandExecuted;
      case "open-settings":
        dependencies.setActiveTab("settings");
        dependencies.emitToRenderer({ type: "open-settings" });
        return commandExecuted;
      case "reload-from-disk":
        return (
          (await dependencies.reloadActiveDocumentFromDisk()) ?? commandExecuted
        );
      case "save":
        return (await dependencies.saveActiveDocument()) ?? commandExecuted;
      case "save-as":
        return (await dependencies.saveActiveDocumentAs()) ?? commandExecuted;
      case "toggle-mode":
        dependencies.setModeForActiveDocument(dependencies.getNextEditorMode());
        dependencies.persistSessionStateSoon();
        return commandExecuted;
      case "open-devtools":
        if (dependencies.isDevelopment) {
          dependencies.openDevTools();
        }
        return commandExecuted;
    }
    return commandExecuted;
  }

  return { handleCommand };
}
