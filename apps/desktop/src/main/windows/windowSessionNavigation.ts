import path from "node:path";
import type { createDocumentModes } from "../documents/documentModes";
import { isEditorViewMode } from "../persistence/appPersistence";
import type { createWindowPersistenceServices } from "../persistence/windowPersistenceServices";
import { isPathInsideDirectory } from "../workspace/desktopWorkspace";
import type { WindowSessionState } from "./windowSessionState";
export type WindowSessionNavigationDependencies = {
  state: WindowSessionState;
  modes: ReturnType<typeof createDocumentModes>;
  getPersistence(): ReturnType<typeof createWindowPersistenceServices>;
  updateActiveFileWatcher(): void;
  persistSessionStateSoon(): void;
  emitShellSnapshot(): void;
};
export function createWindowSessionNavigation(
  dependencies: WindowSessionNavigationDependencies
) {
  function getAuthorizedAssetRoots(): string[] {
    const roots = new Set<string>();

    if (dependencies.state.value.workspacePath) {
      roots.add(dependencies.state.value.workspacePath);
    }

    for (const document of dependencies.state.value.documents) {
      if (
        document.location.kind === "desktop-path" &&
        (!dependencies.state.value.workspacePath ||
          !isPathInsideDirectory(
            dependencies.state.value.workspacePath,
            document.location.path
          ))
      ) {
        roots.add(path.dirname(document.location.path));
      }
    }

    return [...roots];
  }

  function setEditorMode(mode: unknown): void {
    if (!isEditorViewMode(mode)) {
      return;
    }

    dependencies.modes.setModeForActiveDocument(mode);
    dependencies.persistSessionStateSoon();
  }

  async function setActiveDocument(documentId: unknown): Promise<void> {
    if (
      typeof documentId !== "string" ||
      !dependencies.state.value.documents.some(
        (document) => document.id === documentId
      )
    ) {
      return;
    }

    dependencies.state.update({
      activeDocumentId: documentId,
      activeTabId: documentId
    });
    dependencies.modes.syncEditorModeForActiveDocument();
    dependencies.updateActiveFileWatcher();
    await dependencies
      .getPersistence()
      .reconciliation.reconcileDocumentWithDisk(documentId, {
        emitSnapshot: false
      });
    dependencies.persistSessionStateSoon();
    dependencies.emitShellSnapshot();
  }

  async function setActiveTab(tabId: unknown): Promise<void> {
    if (tabId === "settings") {
      dependencies.state.update({ activeTabId: "settings" });
      dependencies.emitShellSnapshot();
      return;
    }

    await setActiveDocument(tabId);
  }

  function updatePaneSizes(paneSizes: unknown): void {
    if (
      !Array.isArray(paneSizes) ||
      !paneSizes.every((paneSize) => typeof paneSize === "number")
    ) {
      return;
    }

    dependencies.state.update({ paneSizes });
    dependencies.persistSessionStateSoon();
  }
  return {
    getAuthorizedAssetRoots,
    setEditorMode,
    setActiveDocument,
    setActiveTab,
    updatePaneSizes
  };
}
