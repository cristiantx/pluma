import type { CommandName, RendererEvent } from "./shellState";
import type { WorkspaceSearchMatch } from "./shellState";
import type { WorkspaceSearchOptions } from "./shellState";
import type { AppSettings, EditorViewMode } from "@pluma/ui";

declare global {
  interface Window {
    pluma: {
      closeTab(tabId: string): Promise<void>;
      getSettings(): Promise<AppSettings>;
      openWorkspaceFile(path: string): Promise<void>;
      searchWorkspace(
        query: string,
        folderPath: string | null,
        options: WorkspaceSearchOptions
      ): Promise<WorkspaceSearchMatch[]>;
      runCommand(command: CommandName): Promise<void>;
      setActiveDocument(documentId: string): Promise<void>;
      setEditorMode(mode: EditorViewMode): Promise<void>;
      showTabContextMenu(tabId: string): Promise<void>;
      showWorkspaceContextMenu(
        path: string,
        kind: "file" | "folder"
      ): Promise<void>;
      updateDocumentText(documentId: string, rawText: string): Promise<void>;
      updatePaneSizes(paneSizes: number[]): Promise<void>;
      updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
      onEvent(listener: (event: RendererEvent) => void): () => void;
    };
  }
}

export {};
