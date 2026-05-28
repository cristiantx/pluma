import type { CommandName, RendererEvent } from "./shellState";

declare global {
  interface Window {
    pluma: {
      openWorkspaceFile(path: string): Promise<void>;
      runCommand(command: CommandName): Promise<void>;
      onEvent(listener: (event: RendererEvent) => void): () => void;
    };
  }
}

export {};
