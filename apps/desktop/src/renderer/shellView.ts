import { getFileLocationName, type DocumentSession } from "@pluma/core";
import type { EditorTab, ExplorerNode, PlumaShellSnapshot } from "@pluma/ui";

import type { DesktopShellSnapshot } from "../shared/shellState";

function getDocuments(state: DesktopShellSnapshot): DocumentSession[] {
  return state.documents ?? [];
}

export function extractLeafName(path: string | null): string | null {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[/\\]/);
  const leaf = segments[segments.length - 1];

  return leaf || normalized;
}

export function getWorkspaceLabel(state: DesktopShellSnapshot): string {
  return getWorkspaceLabelFromState(state.workspacePath, getDocuments(state));
}

export function getWorkspaceLabelFromState(
  workspacePath: string | null,
  documents: DocumentSession[]
): string {
  const firstDocument = documents[0] ?? null;

  return (
    extractLeafName(workspacePath) ??
    (firstDocument ? getFileLocationName(firstDocument.location) : null) ??
    "No workspace open"
  );
}

export function getExplorerNodes(state: DesktopShellSnapshot): ExplorerNode[] {
  return getExplorerNodesFromEntries(
    state.workspaceEntries,
    getActiveDocument(state)
  );
}

export function getExplorerNodesFromEntries(
  workspaceEntries: DesktopShellSnapshot["workspaceEntries"],
  activeDocument: DocumentSession | null
): ExplorerNode[] {
  return workspaceEntries.map((entry) => ({
    depth: entry.depth,
    id: entry.path,
    isActive:
      entry.kind === "file" &&
      activeDocument?.location.kind === "desktop-path" &&
      activeDocument.location.path === entry.path,
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

export function getOpenTabs(state: DesktopShellSnapshot): EditorTab[] {
  return getDocuments(state).map((document) => ({
    id: document.id,
    isDirty: document.saveState !== "idle",
    kind: "document" as const,
    location: document.location,
    title: getFileLocationName(document.location)
  }));
}

export function getActiveDocument(
  state: DesktopShellSnapshot
): DocumentSession | null {
  return (
    getDocuments(state).find(
      (document) => document.id === state.activeDocumentId
    ) ?? null
  );
}

export function getShellSnapshot(
  shellState: DesktopShellSnapshot,
  isBridgeAvailable: boolean
): PlumaShellSnapshot {
  return {
    activeDocument: getActiveDocument(shellState),
    activeDocumentId: shellState.activeDocumentId,
    activeTabId: shellState.activeTabId,
    documents: getDocuments(shellState),
    documentViewModes: shellState.documentViewModes,
    explorerNodes: getExplorerNodes(shellState),
    hasWorkspace: Boolean(shellState.workspacePath),
    isBridgeAvailable,
    isDevelopment: shellState.isDevelopment,
    editorViewMode: shellState.editorViewMode,
    paneSizes: shellState.paneSizes,
    tabs: getOpenTabs(shellState),
    workspaceLabel: getWorkspaceLabel(shellState),
    workspacePath: shellState.workspacePath ?? "~/Documents/Pluma Docs"
  };
}
