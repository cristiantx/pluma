import { getFileLocationName, type DocumentSession } from "@pluma/core";
import type {
  EditorTab,
  ExplorerNode,
  PlumaShellSnapshot,
  StatusMetric
} from "@pluma/ui";

import type { ShellState } from "./shellState";

export function extractLeafName(path: string | null): string | null {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[/\\]/);
  const leaf = segments[segments.length - 1];

  return leaf || normalized;
}

export function getWorkspaceLabel(state: ShellState): string {
  return (
    extractLeafName(state.workspacePath) ??
    (state.documents[0]
      ? getFileLocationName(state.documents[0].location)
      : null) ??
    "No workspace open"
  );
}

export function getStatusMetrics(state: ShellState): StatusMetric[] {
  const activeDocument = getActiveDocument(state);
  const sourceText = activeDocument?.rawText ?? "";
  const lines = sourceText ? sourceText.split(/\r?\n/).length : 0;
  const words = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;

  return [
    {
      label: "Words",
      value: activeDocument ? String(words) : "--"
    },
    {
      label: "Lines",
      value: activeDocument ? String(lines) : "--"
    },
    {
      label: "Mode",
      value: state.mode === "rich" ? "Rich" : "Source"
    },
    {
      label: "Save",
      value: activeDocument ? toSaveMetricValue(activeDocument) : "Idle shell"
    }
  ];
}

export function getExplorerNodes(state: ShellState): ExplorerNode[] {
  const activeDocument = getActiveDocument(state);

  return state.workspaceEntries.map((entry) => ({
    depth: entry.depth,
    id: entry.path,
    isActive:
      entry.kind === "file" &&
      activeDocument?.location.kind === "desktop-path" &&
      activeDocument.location.path === entry.path,
    isExpanded: entry.kind === "folder",
    kind: entry.kind,
    label: entry.name,
    ...(entry.kind === "file" || entry.kind === "folder"
      ? {
          location: {
            kind: "desktop-path" as const,
            path: entry.path
          }
        }
      : {})
  }));
}

export function getOpenTabs(state: ShellState): EditorTab[] {
  return state.documents.map((document) => ({
    id: document.id,
    isDirty: document.saveState !== "idle",
    location: document.location,
    title: getFileLocationName(document.location)
  }));
}

export function getActiveDocument(state: ShellState): DocumentSession | null {
  return (
    state.documents.find(
      (document) => document.id === state.activeDocumentId
    ) ?? null
  );
}

export function getShellSnapshot(
  shellState: ShellState,
  isBridgeAvailable: boolean
): PlumaShellSnapshot {
  return {
    activeDocument: getActiveDocument(shellState),
    activeDocumentId: shellState.activeDocumentId,
    documents: shellState.documents,
    explorerNodes: getExplorerNodes(shellState),
    hasWorkspace: Boolean(shellState.workspacePath),
    isBridgeAvailable,
    statusMetrics: getStatusMetrics(shellState),
    tabs: getOpenTabs(shellState),
    workspaceLabel: getWorkspaceLabel(shellState),
    workspacePath: shellState.workspacePath ?? "~/Documents/Pluma Docs"
  };
}

function toSaveMetricValue(document: DocumentSession): string {
  switch (document.saveState) {
    case "idle":
      return "Saved";
    case "dirty":
      return "Dirty";
    case "saving":
      return "Saving";
    case "conflict":
      return "Conflict";
  }
}
