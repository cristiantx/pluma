import type { StoreApi } from "zustand";

import { closeDesktopDocumentState } from "./plumaDesktopState.js";
import { hydratePlumaShellSnapshot } from "./plumaStoreHydration.js";
import type {
  EditorSnapshotsSlice,
  EditorStateActions,
  PlumaStore
} from "./plumaStoreTypes.js";

type EditorLifecycleActions = EditorStateActions &
  Pick<PlumaStore, "hydrateDocumentClosed" | "hydrateShellSnapshot">;

export function createEditorStateActions(
  set: StoreApi<PlumaStore>["setState"]
): EditorLifecycleActions {
  return {
    resetEditorBaseline: (documentId) =>
      set((state) => {
        if (!state.document.documents.some(({ id }) => id === documentId))
          return state;
        return {
          editorSnapshots: {
            ...state.editorSnapshots,
            [documentId]: {
              cursor: null,
              scroll: null,
              baselineRevision:
                (state.editorSnapshots[documentId]?.baselineRevision ?? 0) + 1
            }
          }
        };
      }),
    setEditorCursorAnchor: (anchor) => {
      set((state) => {
        if (
          !state.document.documents.some(({ id }) => id === anchor.documentId)
        )
          return state;
        const snapshot = state.editorSnapshots[anchor.documentId];
        return {
          editorSnapshots: {
            ...state.editorSnapshots,
            [anchor.documentId]: {
              ...snapshot,
              cursor: structuredClone(anchor),
              scroll: snapshot?.scroll ?? null
            }
          }
        };
      });
    },
    setEditorScrollAnchor: (anchor) => {
      set((state) => {
        if (
          !state.document.documents.some(({ id }) => id === anchor.documentId)
        )
          return state;
        const snapshot = state.editorSnapshots[anchor.documentId];
        return {
          editorSnapshots: {
            ...state.editorSnapshots,
            [anchor.documentId]: {
              ...snapshot,
              cursor: snapshot?.cursor ?? null,
              scroll: structuredClone(anchor)
            }
          }
        };
      });
    },
    clearEditorSnapshot: (documentId) => {
      set((state) => ({
        editorSnapshots: removeEditorSnapshot(state.editorSnapshots, documentId)
      }));
    },
    hydrateDocumentClosed: (documentId) => {
      set((state) => ({
        ...closeDesktopDocumentState(state, documentId),
        editorSnapshots: removeEditorSnapshot(state.editorSnapshots, documentId)
      }));
    },
    hydrateShellSnapshot: (snapshot) => {
      set((state) => {
        const documentIds = new Set(snapshot.documents.map(({ id }) => id));
        return {
          ...hydratePlumaShellSnapshot(state, snapshot),
          editorSnapshots: Object.fromEntries(
            Object.entries(state.editorSnapshots).filter(([id]) =>
              documentIds.has(id)
            )
          )
        };
      });
    }
  };
}

function removeEditorSnapshot(
  snapshots: EditorSnapshotsSlice,
  documentId: string
): EditorSnapshotsSlice {
  if (!Object.hasOwn(snapshots, documentId)) return snapshots;
  const nextSnapshots = { ...snapshots };
  delete nextSnapshots[documentId];
  return nextSnapshots;
}
