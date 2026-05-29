import type { CommandName, RendererEvent } from "./shellState";
import type { ThemePreference } from "@pluma/ui";

type AppSettings = {
  themePreference: ThemePreference;
};

declare global {
  interface Window {
    pluma: {
      closeTab(tabId: string): Promise<void>;
      getSettings(): Promise<AppSettings>;
      openWorkspaceFile(path: string): Promise<void>;
      runCommand(command: CommandName): Promise<void>;
      updatePaneSizes(paneSizes: number[]): Promise<void>;
      updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
      onEvent(listener: (event: RendererEvent) => void): () => void;
    };
  }
}

export {};
