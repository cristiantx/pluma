import type { CommandName, RendererEvent } from "./shellState";
import type { EditorViewMode, ThemePreference } from "@pluma/ui";

type AppSettings = {
  autosaveEnabled: boolean;
  themePreference: ThemePreference;
};

declare global {
  interface Window {
    pluma: {
      closeTab(tabId: string): Promise<void>;
      getSettings(): Promise<AppSettings>;
      openWorkspaceFile(path: string): Promise<void>;
      runCommand(command: CommandName): Promise<void>;
      setActiveDocument(documentId: string): Promise<void>;
      setEditorMode(mode: EditorViewMode): Promise<void>;
      updateDocumentText(documentId: string, rawText: string): Promise<void>;
      updatePaneSizes(paneSizes: number[]): Promise<void>;
      updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
      onEvent(listener: (event: RendererEvent) => void): () => void;
    };
  }
}

export {};
