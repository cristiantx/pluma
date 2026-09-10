import {
  commandExecuted,
  type CommandExecutionResult,
  type CommandContext,
  type CommandInvocationContext
} from "@pluma/commands";
import type { DesktopShellSnapshot } from "../../shared/shellState";

export function getWindowCommandContext(
  snapshot: DesktopShellSnapshot
): CommandContext {
  const document =
    snapshot.activeTabId === snapshot.activeDocumentId
      ? snapshot.documents.find((item) => item.id === snapshot.activeDocumentId)
      : undefined;
  return {
    hasActiveDocument: Boolean(document),
    canCloseActiveTab: Boolean(snapshot.activeTabId),
    canEditDocument: Boolean(document && snapshot.editorViewMode !== "preview"),
    canKeepEditing:
      document?.saveState === "conflict" ||
      document?.saveState === "external-change",
    canReloadDocument: document?.location.kind === "desktop-path",
    isDevelopment: snapshot.isDevelopment
  };
}

export function getWindowInvocationContext(
  snapshot: DesktopShellSnapshot
): CommandInvocationContext {
  return {
    activeTabId: snapshot.activeTabId,
    documentId:
      snapshot.activeTabId === snapshot.activeDocumentId
        ? snapshot.activeDocumentId
        : null,
    workspaceGeneration: snapshot.workspaceIndex?.generation ?? 0
  };
}

export type QuickAccessHandlerPorts = {
  getSnapshot(): DesktopShellSnapshot;
  setOpen(open: boolean): void;
  activate(documentId: string): Promise<void>;
  openFile(path: string): Promise<unknown>;
  refresh(): Promise<void>;
};

export async function handleQuickAccessRequest(
  value: unknown,
  ports: QuickAccessHandlerPorts
): Promise<CommandExecutionResult> {
  const unavailable = (): CommandExecutionResult => ({
    status: "unavailable",
    reason: "This file is no longer available. Search again."
  });
  if (!value || typeof value !== "object") return unavailable();
  const request = value as Record<string, unknown>;
  if (request.kind === "flush") return commandExecuted;
  if (request.kind === "set-open" && typeof request.open === "boolean") {
    ports.setOpen(request.open);
    return commandExecuted;
  }
  if (request.kind === "refresh") {
    await ports.refresh();
    return commandExecuted;
  }
  const snapshot = ports.getSnapshot();
  if (
    request.kind === "open-document" &&
    typeof request.documentId === "string"
  ) {
    if (
      !snapshot.documents.some((document) => document.id === request.documentId)
    )
      return unavailable();
    await ports.activate(request.documentId);
    return ports.getSnapshot().activeTabId === request.documentId
      ? commandExecuted
      : unavailable();
  }
  if (request.kind === "workspace-file" && typeof request.path === "string") {
    if (
      request.workspaceGeneration !==
        (snapshot.workspaceIndex?.generation ?? 0) ||
      !snapshot.workspaceEntries.some(
        (entry) => entry.kind === "file" && entry.path === request.path
      )
    )
      return unavailable();
    const result = await ports.openFile(request.path);
    if (result && typeof result === "object" && "status" in result)
      return result as CommandExecutionResult;
    return unavailable();
  }
  return unavailable();
}
