import type { DocumentSession } from "@pluma/core";

import type {
  DesktopDocumentPatch,
  DesktopShellSnapshot,
  RendererEvent
} from "../../shared/shellState";

export function getShellStateEvents(
  previous: DesktopShellSnapshot,
  current: DesktopShellSnapshot
): RendererEvent[] {
  const events: RendererEvent[] = [];
  const previousDocuments = new Map(
    previous.documents.map((document) => [document.id, document])
  );
  const currentDocumentIds = new Set(
    current.documents.map((document) => document.id)
  );

  for (const document of previous.documents) {
    if (!currentDocumentIds.has(document.id)) {
      events.push({ documentId: document.id, type: "document-closed" });
    }
  }

  current.documents.forEach((document, index) => {
    const previousDocument = previousDocuments.get(document.id);

    if (!previousDocument) {
      events.push({
        document,
        index,
        type: "document-opened",
        viewMode: current.documentViewModes[document.id] ?? "source"
      });
      return;
    }

    const patch = createDocumentPatch(previousDocument, document);
    if (Object.keys(patch).length > 0) {
      events.push({
        documentId: document.id,
        patch,
        type: "document-patched"
      });
    }

    const previousMode = previous.documentViewModes[document.id];
    const currentMode = current.documentViewModes[document.id];
    if (currentMode && previousMode !== currentMode) {
      events.push({
        documentId: document.id,
        type: "document-view-mode-changed",
        viewMode: currentMode
      });
    }
  });

  if (
    previous.activeDocumentId !== current.activeDocumentId ||
    previous.activeTabId !== current.activeTabId ||
    previous.editorViewMode !== current.editorViewMode
  ) {
    events.push({
      activeDocumentId: current.activeDocumentId,
      activeTabId: current.activeTabId,
      editorViewMode: current.editorViewMode,
      type: "active-document-changed"
    });
  }

  if (
    previous.workspacePath !== current.workspacePath ||
    previous.workspaceEntries !== current.workspaceEntries ||
    JSON.stringify(previous.workspaceIndex) !==
      JSON.stringify(current.workspaceIndex)
  ) {
    events.push({
      type: "workspace-changed",
      ...(current.workspaceIndex
        ? { workspaceIndex: current.workspaceIndex }
        : {}),
      workspaceEntries: current.workspaceEntries,
      workspacePath: current.workspacePath
    });
  }

  return events;
}

function createDocumentPatch(
  previous: DocumentSession,
  current: DocumentSession
): DesktopDocumentPatch {
  return {
    ...(previous.lastSavedMetadata !== current.lastSavedMetadata
      ? { lastSavedMetadata: current.lastSavedMetadata }
      : {}),
    ...(previous.lastSavedText !== current.lastSavedText
      ? { lastSavedText: current.lastSavedText }
      : {}),
    ...(previous.lineEnding !== current.lineEnding
      ? { lineEnding: current.lineEnding }
      : {}),
    ...(previous.location !== current.location
      ? { location: current.location }
      : {}),
    ...(previous.mode !== current.mode ? { mode: current.mode } : {}),
    ...(previous.modeConstraint !== current.modeConstraint
      ? { modeConstraint: current.modeConstraint }
      : {}),
    ...(previous.rawText !== current.rawText
      ? { rawText: current.rawText }
      : {}),
    ...(previous.saveState !== current.saveState
      ? { saveState: current.saveState }
      : {})
  };
}
