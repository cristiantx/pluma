import type {
  CommandExecutionResult,
  CommandInvocationContext,
  CommandPlatform,
  CommandRequest
} from "@pluma/commands";
import type { FileCandidate, FileSearchResult } from "@pluma/core";

export type QuickAccessMode = "files" | "commands";
export type QuickAccessTarget =
  | { kind: "open-document"; documentId: string }
  | { kind: "workspace-file"; path: string; workspaceGeneration: number };
export type QuickAccessServices = {
  platform: CommandPlatform;
  nativeAccelerators: boolean;
  search(
    candidates: FileCandidate[],
    query: string
  ): Promise<{ results: FileSearchResult[]; total: number }>;
  execute(
    request: CommandRequest,
    context: CommandInvocationContext
  ): Promise<CommandExecutionResult>;
  activate(target: QuickAccessTarget): Promise<CommandExecutionResult>;
  flush(): Promise<CommandExecutionResult>;
  setOpen(open: boolean): void;
  refresh(): Promise<unknown>;
};
export type QuickAccessSnapshot = {
  history: Record<string, number>;
  resultsQuery: string;
  mode: QuickAccessMode | null;
  queries: Record<QuickAccessMode, string>;
  selections: Record<QuickAccessMode, string | null>;
  openingId: number;
  focusRequestId: number;
  requestId: number;
  busy: boolean;
  executing: boolean;
  error: string | null;
  results: FileSearchResult[];
  total: number;
};
export type QuickAccessActions = {
  openQuickAccess(mode: QuickAccessMode): void;
  closeQuickAccess(): void;
  updateQuickAccess(update: Partial<QuickAccessSnapshot>): void;
  setQuickAccessServices(services: QuickAccessServices): void;
};
