import type { DocumentSession } from "@pluma/core";
import type { AppSettings } from "@pluma/ui";

export type EditorMode = "rich" | "source";
export type EditorViewMode = EditorMode | "split";

export type WorkspaceTreeEntry = {
  depth: number;
  kind: "folder" | "file";
  name: string;
  path: string;
};

export type WorkspaceSearchMatch = {
  filePath: string;
  line: number;
  lineText: string;
  matchEnd: number;
  matchStart: number;
  preview: string;
};

export type WorkspaceSearchOptions = {
  caseSensitive: boolean;
  regexp: boolean;
  wholeWord: boolean;
};

export type DesktopShellSnapshot = {
  activeDocumentId: string | null;
  activeTabId: string | null;
  documents: DocumentSession[];
  isDevelopment: boolean;
  paneSizes: number[];
  status: string;
  workspaceEntries: WorkspaceTreeEntry[];
  workspacePath: string | null;
};

export type RendererEvent =
  | { type: "editor-command"; command: EditorCommandName }
  | { type: "find-in-folder"; path: string }
  | { type: "mode-changed"; mode: EditorViewMode }
  | { type: "open-settings" }
  | { type: "reveal-workspace-file"; path: string }
  | { type: "settings-changed"; settings: AppSettings }
  | { type: "shell-snapshot"; snapshot: DesktopShellSnapshot }
  | { type: "status"; message: string };

export type EditorCommandName =
  | "find"
  | "find-next"
  | "find-previous"
  | "replace";

export type CommandName =
  | "close-active-tab"
  | "compare-conflict"
  | EditorCommandName
  | "export-html"
  | "export-pdf"
  | "keep-editing"
  | "new-file"
  | "new-window"
  | "open-devtools"
  | "open-file"
  | "open-folder"
  | "open-settings"
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
  activeTabId: null,
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
    activeTabId: snapshot.activeTabId ?? snapshot.activeDocumentId ?? null,
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
    case "editor-command":
      return current;
    case "find-in-folder":
      return current;
    case "mode-changed":
      return {
        ...current,
        mode: event.mode,
        status: `Editor mode switched to ${event.mode}.`,
        activity: appendActivity(current.activity, `Mode: ${event.mode}`)
      };
    case "open-settings":
      return current;
    case "reveal-workspace-file":
      return current;
    case "settings-changed":
      return current;
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
