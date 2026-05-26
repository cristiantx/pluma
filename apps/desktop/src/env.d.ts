import type { CommandName, RendererEvent } from "./shell-state";

declare global {
  interface Window {
    pluma: {
      runCommand(command: CommandName): Promise<void>;
      onEvent(listener: (event: RendererEvent) => void): () => void;
    };
  }
}

export {};
