import { parseCommandRequest } from "./commandRequests.js";
import type { CommandRequest } from "./commandRegistry.js";

export type CommandExecutionResult =
  | { status: "executed" }
  | { status: "cancelled" }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; message: string };

export type CommandInvocationContext = {
  activeTabId: string | null;
  documentId: string | null;
  workspaceGeneration: number;
};

export type CommandInvocation = {
  request: CommandRequest;
  context: CommandInvocationContext;
};

export function parseCommandInvocation(
  value: unknown
): CommandInvocation | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "request" && key !== "context"))
    return null;
  const request = parseCommandRequest(record.request);
  const context = record.context as Record<string, unknown> | null;
  if (!request || !context || typeof context !== "object") return null;
  if (
    Object.keys(context).sort().join(",") !==
    "activeTabId,documentId,workspaceGeneration"
  )
    return null;
  if (
    ![context.activeTabId, context.documentId].every(
      (id) => id === null || typeof id === "string"
    )
  )
    return null;
  if (
    !Number.isSafeInteger(context.workspaceGeneration) ||
    (context.workspaceGeneration as number) < 0
  )
    return null;
  return { request, context: context as CommandInvocationContext };
}

export const commandExecuted: CommandExecutionResult = { status: "executed" };
export const commandCancelled: CommandExecutionResult = { status: "cancelled" };
