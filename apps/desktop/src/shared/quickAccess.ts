export type QuickAccessRequest =
  | { kind: "flush" }
  | { kind: "set-open"; open: boolean }
  | { kind: "refresh" }
  | { kind: "open-document"; documentId: string }
  | { kind: "workspace-file"; path: string; workspaceGeneration: number };

export type WorkspaceIndexState = {
  generation: number;
  revision: number;
  status: "loading" | "ready" | "error";
  error: string | null;
};
