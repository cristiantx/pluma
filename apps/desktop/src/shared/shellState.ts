import type { DocumentSession } from "@pluma/core";

export type EditorMode = "rich" | "source";
export type EditorViewMode = EditorMode | "split";

export type WorkspaceTreeEntry = {
  depth: number;
  kind: "folder" | "file";
  name: string;
  path: string;
};

export type DesktopShellSnapshot = {
  activeDocumentId: string | null;
  documents: DocumentSession[];
  isDevelopment: boolean;
  paneSizes: number[];
  status: string;
  workspaceEntries: WorkspaceTreeEntry[];
  workspacePath: string | null;
};

export type RendererEvent =
  | { type: "mode-changed"; mode: EditorViewMode }
  | { type: "shell-snapshot"; snapshot: DesktopShellSnapshot }
  | { type: "status"; message: string };

export type CommandName =
  | "compare-conflict"
  | "keep-editing"
  | "open-devtools"
  | "open-file"
  | "open-folder"
  | "reload-from-disk"
  | "save"
  | "save-as"
  | "toggle-mode";

export type ShellState = DesktopShellSnapshot & {
  activity: string[];
  mode: EditorViewMode;
};

export const initialShellState: ShellState = {
  activeDocumentId: null,
  activity: [],
  documents: [],
  isDevelopment: false,
  mode: "source",
  paneSizes: [],
  status: "Starting desktop shell...",
  workspaceEntries: [],
  workspacePath: null
};

export function appendActivity(activity: string[], message: string): string[] {
  return [message, ...activity].slice(0, 6);
}

function normalizeDesktopShellSnapshot(
  snapshot: Partial<DesktopShellSnapshot>
): DesktopShellSnapshot {
  return {
    activeDocumentId: snapshot.activeDocumentId ?? null,
    documents: snapshot.documents ?? [],
    isDevelopment: snapshot.isDevelopment ?? false,
    paneSizes: snapshot.paneSizes ?? [],
    status: snapshot.status ?? initialShellState.status,
    workspaceEntries: snapshot.workspaceEntries ?? [],
    workspacePath: snapshot.workspacePath ?? null
  };
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
    case "shell-snapshot": {
      const normalizedSnapshot = normalizeDesktopShellSnapshot(
        event.snapshot as Partial<DesktopShellSnapshot>
      );

      return {
        ...current,
        ...normalizedSnapshot,
        activity: appendActivity(current.activity, normalizedSnapshot.status)
      };
    }
    case "status":
      return {
        ...current,
        status: event.message,
        activity: appendActivity(current.activity, event.message)
      };
  }
}
