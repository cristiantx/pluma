export type EditorMode = "rich" | "source";

export type RendererEvent =
  | { type: "file-opened"; path: string }
  | { type: "folder-opened"; path: string }
  | { type: "save-requested" }
  | { type: "save-as-requested" }
  | { type: "mode-changed"; mode: EditorMode }
  | { type: "status"; message: string };

export type CommandName =
  | "open-file"
  | "open-folder"
  | "save"
  | "save-as"
  | "toggle-mode";

export type ShellState = {
  mode: EditorMode;
  status: string;
  activeFile: string | null;
  activeFolder: string | null;
  activity: string[];
};

export const initialShellState: ShellState = {
  mode: "rich",
  status: "Starting desktop shell...",
  activeFile: null,
  activeFolder: null,
  activity: []
};

export function appendActivity(activity: string[], message: string): string[] {
  return [message, ...activity].slice(0, 6);
}

export function reduceShellEvent(
  current: ShellState,
  event: RendererEvent
): ShellState {
  switch (event.type) {
    case "file-opened":
      return {
        ...current,
        activeFile: event.path,
        status: "File selection received by the desktop shell.",
        activity: appendActivity(current.activity, `Open file: ${event.path}`)
      };
    case "folder-opened":
      return {
        ...current,
        activeFolder: event.path,
        status: "Folder selection received by the desktop shell.",
        activity: appendActivity(current.activity, `Open folder: ${event.path}`)
      };
    case "save-requested":
      return {
        ...current,
        status: "Save requested. Document persistence arrives in Phase 2.",
        activity: appendActivity(current.activity, "Save requested")
      };
    case "save-as-requested":
      return {
        ...current,
        status: "Save As requested. Document persistence arrives in Phase 2.",
        activity: appendActivity(current.activity, "Save As requested")
      };
    case "mode-changed":
      return {
        ...current,
        mode: event.mode,
        status: `Editor mode switched to ${event.mode}.`,
        activity: appendActivity(current.activity, `Mode: ${event.mode}`)
      };
    case "status":
      return {
        ...current,
        status: event.message,
        activity: appendActivity(current.activity, event.message)
      };
  }
}
