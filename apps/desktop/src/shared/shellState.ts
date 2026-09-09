import type { DocumentSession } from "@pluma/core";
import type { AppSettings, EditorViewMode } from "@pluma/ui";

export type {
  EditorViewMode,
  WorkspaceSearchMatch,
  WorkspaceSearchOptions
} from "@pluma/ui";

export type WorkspaceTreeEntry = {
  depth: number;
  kind: "folder" | "file";
  name: string;
  path: string;
};

export type DesktopShellSnapshot = {
  activeDocumentId: string | null;
  activeTabId: string | null;
  documentViewModes: Record<string, EditorViewMode>;
  documents: DocumentSession[];
  editorViewMode: EditorViewMode;
  isDevelopment: boolean;
  paneSizes: number[];
  status: string;
  workspaceEntries: WorkspaceTreeEntry[];
  workspacePath: string | null;
};

export type DesktopDocumentPatch = Partial<Omit<DocumentSession, "id">>;

export type RendererEvent =
  | { type: "document-baseline-reset"; documentId: string }
  | {
      activeDocumentId: string | null;
      activeTabId: string | null;
      editorViewMode: EditorViewMode;
      type: "active-document-changed";
    }
  | {
      documentId: string;
      type: "document-closed";
    }
  | {
      document: DocumentSession;
      index: number;
      type: "document-opened";
      viewMode: EditorViewMode;
    }
  | {
      documentId: string;
      patch: DesktopDocumentPatch;
      type: "document-patched";
    }
  | {
      documentId: string;
      type: "document-view-mode-changed";
      viewMode: EditorViewMode;
    }
  | { type: "editor-command"; command: EditorCommandName }
  | { type: "find-in-folder"; path: string }
  | { type: "mode-changed"; mode: EditorViewMode }
  | { type: "close-settings-tab" }
  | { type: "open-settings" }
  | { type: "reveal-workspace-file"; path: string }
  | { type: "settings-changed"; settings: AppSettings }
  | { type: "shell-snapshot"; snapshot: DesktopShellSnapshot }
  | { type: "status"; message: string }
  | {
      type: "workspace-changed";
      workspaceEntries: WorkspaceTreeEntry[];
      workspacePath: string | null;
    };

type EditorCommandName = "find" | "find-next" | "find-previous" | "replace";

export type CommandName =
  | "close-active-tab"
  | EditorCommandName
  | "export-html"
  | "export-pdf"
  | "force-reload-window"
  | "keep-editing"
  | "new-file"
  | "new-window"
  | "open-devtools"
  | "open-file"
  | "open-folder"
  | "open-settings"
  | "reload-from-disk"
  | "reload-window"
  | "save"
  | "save-as"
  | "toggle-mode";

export const initialDesktopShellSnapshot: DesktopShellSnapshot = {
  activeDocumentId: null,
  activeTabId: null,
  documentViewModes: {},
  documents: [],
  editorViewMode: "source",
  isDevelopment: false,
  paneSizes: [],
  status: "Starting desktop shell...",
  workspaceEntries: [],
  workspacePath: null
};
