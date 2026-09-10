import type { createDocumentModes } from "../documents/documentModes";
import { type PersistedWindowSessionState } from "../persistence/appPersistence";
import type { createWindowPersistenceServices } from "../persistence/windowPersistenceServices";
import type { WindowSessionState } from "../windows/windowSessionState";
import type { createWindowSurfaceServices } from "../windows/windowSurfaceServices";
import { restoreWindowSession } from "./windowSessionRestoration";
export type WindowRestorationControllerDependencies = {
  state: WindowSessionState;
  modes: ReturnType<typeof createDocumentModes>;
  getPersistence(): ReturnType<typeof createWindowPersistenceServices>;
  getSurface(): ReturnType<typeof createWindowSurfaceServices>;
  waitForRendererReady(): Promise<void>;
  updateActiveFileWatcher(): void;
  updateWorkspaceWatcher(): void;
  emitShellSnapshot(): void;
};
export function createWindowRestorationController(
  dependencies: WindowRestorationControllerDependencies
) {
  let disposed = false;
  let restorationGeneration = 0;
  async function restorePersistedState(
    persistedState: PersistedWindowSessionState
  ): Promise<void> {
    dependencies.modes.currentMode = persistedState.editorMode;
    dependencies.modes.documentModes.clear();
    const generation = ++restorationGeneration;
    await restoreWindowSession(persistedState, {
      isCurrent: () => !disposed && restorationGeneration === generation,
      getDocuments: () => dependencies.state.value.documents,
      loadReference: (ref) =>
        dependencies
          .getPersistence()
          .referenceLoader.createSessionForPersistedDocumentRef(ref),
      setDocumentMode: (doc, mode) =>
        dependencies.modes.setStoredDocumentMode(doc, mode),
      publishInitial: (activeDocument, persistedState) => {
        dependencies.state.update({
          activeDocumentId:
            dependencies.state.value.activeDocumentId ??
            activeDocument?.id ??
            null,
          activeTabId:
            dependencies.state.value.activeTabId ?? activeDocument?.id ?? null,
          documents:
            activeDocument &&
            !dependencies.state.getDocumentById(activeDocument.id)
              ? [activeDocument, ...dependencies.state.value.documents]
              : dependencies.state.value.documents,
          paneSizes: persistedState.paneSizes ?? [],
          status:
            activeDocument || persistedState.workspacePath
              ? "Restored previous session."
              : "Desktop shell ready.",
          workspaceEntries: [],
          workspacePath: persistedState.workspacePath
        });
        dependencies.modes.syncEditorModeForActiveDocument({ emit: false });
        dependencies.updateActiveFileWatcher();
        dependencies.updateWorkspaceWatcher();
        dependencies.emitShellSnapshot();
      },
      publishDocuments: (documents) => {
        dependencies.state.update({ documents });
        dependencies.emitShellSnapshot();
      },
      waitForRendererReady: dependencies.waitForRendererReady,
      refreshWorkspace: () => dependencies.getSurface().workspace.refresh()
    });
  }
  return {
    restorePersistedState,
    dispose() {
      disposed = true;
      restorationGeneration += 1;
    },
    invalidate() {
      restorationGeneration += 1;
    }
  };
}
