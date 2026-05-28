import type { DocumentSession } from "@pluma/core";

export type EditorMode = "rich" | "source";

export type WorkspaceTreeEntry = {
  depth: number;
  kind: "folder" | "file";
  name: string;
  path: string;
};

export type DesktopShellSnapshot = {
  activeDocumentId: string | null;
  documents: DocumentSession[];
  status: string;
  workspaceEntries: WorkspaceTreeEntry[];
  workspacePath: string | null;
};

export type RendererEvent =
  | { type: "mode-changed"; mode: EditorMode }
  | { type: "shell-snapshot"; snapshot: DesktopShellSnapshot }
  | { type: "status"; message: string };

export type CommandName =
  | "open-file"
  | "open-folder"
  | "save"
  | "save-as"
  | "toggle-mode";

export type ShellState = DesktopShellSnapshot & {
  activity: string[];
  mode: EditorMode;
};

export const initialShellState: ShellState = {
  activeDocumentId: null,
  activity: [],
  documents: [],
  mode: "rich",
  status: "Starting desktop shell...",
  workspaceEntries: [],
  workspacePath: null
};

export function appendActivity(activity: string[], message: string): string[] {
  return [message, ...activity].slice(0, 6);
}

export function reduceShellEvent(
  current: ShellState,
  event: RendererEvent
): ShellState {
  switch (event.type) {
    case "mode-changed":
      return {
        ...current,
        mode: event.mode,
        status: `Editor mode switched to ${event.mode}.`,
        activity: appendActivity(current.activity, `Mode: ${event.mode}`)
      };
    case "shell-snapshot":
      return {
        ...current,
        ...event.snapshot,
        activity: appendActivity(current.activity, event.snapshot.status)
      };
    case "status":
      return {
        ...current,
        status: event.message,
        activity: appendActivity(current.activity, event.message)
      };
  }
}
