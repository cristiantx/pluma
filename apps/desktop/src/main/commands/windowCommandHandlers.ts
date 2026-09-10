import type { CommandName, RendererEvent } from "../../shared/shellState";

export type WindowCommandHandlerDependencies = {
  closeActiveDocumentSession: () => Promise<void>;
  createNewMarkdownFile: () => Promise<void>;
  emitToRenderer: (event: RendererEvent) => void;
  exportActiveDocument: (format: "html" | "pdf") => Promise<void>;
  getNextEditorMode: () => "source" | "rich" | "preview";
  isDevelopment: boolean;
  keepEditingActiveDocument: () => Promise<void>;
  openDevTools: () => void;
  openFileFromDialog: () => Promise<void>;
  openFolderFromDialog: () => Promise<void>;
  persistSessionStateSoon: () => void;
  reloadActiveDocumentFromDisk: () => Promise<void>;
  saveActiveDocument: () => Promise<void>;
  saveActiveDocumentAs: () => Promise<void>;
  setActiveTab: (tabId: "settings") => void;
  setModeForActiveDocument: (mode: "source" | "rich" | "preview") => void;
};

export type WindowCommandHandlers = {
  handleCommand: (command: CommandName) => Promise<void>;
};

export function createWindowCommandHandlers(
  dependencies: WindowCommandHandlerDependencies
): WindowCommandHandlers {
  async function handleCommand(command: CommandName): Promise<void> {
    switch (command) {
      case "close-active-tab":
        await dependencies.closeActiveDocumentSession();
        return;
      case "find":
      case "find-next":
      case "find-previous":
      case "replace":
        dependencies.emitToRenderer({ type: "editor-command", command });
        return;
      case "export-html":
        await dependencies.exportActiveDocument("html");
        return;
      case "export-pdf":
        await dependencies.exportActiveDocument("pdf");
        return;
      case "keep-editing":
        await dependencies.keepEditingActiveDocument();
        return;
      case "new-file":
        await dependencies.createNewMarkdownFile();
        return;
      case "new-window":
      case "reload-window":
      case "force-reload-window":
        return;
      case "open-file":
        await dependencies.openFileFromDialog();
        return;
      case "open-folder":
        await dependencies.openFolderFromDialog();
        return;
      case "open-settings":
        dependencies.setActiveTab("settings");
        dependencies.emitToRenderer({ type: "open-settings" });
        return;
      case "reload-from-disk":
        await dependencies.reloadActiveDocumentFromDisk();
        return;
      case "save":
        await dependencies.saveActiveDocument();
        return;
      case "save-as":
        await dependencies.saveActiveDocumentAs();
        return;
      case "toggle-mode":
        dependencies.setModeForActiveDocument(dependencies.getNextEditorMode());
        dependencies.persistSessionStateSoon();
        return;
      case "open-devtools":
        if (dependencies.isDevelopment) {
          dependencies.openDevTools();
        }
        return;
    }
  }

  return { handleCommand };
}
