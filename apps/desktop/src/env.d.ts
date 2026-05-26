import type { CommandName, RendererEvent } from "./shellState";

declare global {
  interface Window {
    pluma: {
      runCommand(command: CommandName): Promise<void>;
      onEvent(listener: (event: RendererEvent) => void): () => void;
    };
  }
}

export {};
