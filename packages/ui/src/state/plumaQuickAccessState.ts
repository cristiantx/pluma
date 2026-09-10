import type { PlumaStore } from "./plumaStoreTypes.js";
import type {
  QuickAccessActions,
  QuickAccessSnapshot
} from "./plumaQuickAccessTypes.js";

export const initialQuickAccessState: QuickAccessSnapshot = {
  history: {},
  resultsQuery: "",
  mode: null,
  queries: { files: "", commands: "" },
  selections: { files: null, commands: null },
  openingId: 0,
  focusRequestId: 0,
  requestId: 0,
  busy: false,
  executing: false,
  error: null,
  results: [],
  total: 0
};

export function createQuickAccessActions(
  set: (update: (state: PlumaStore) => Partial<PlumaStore>) => void
): QuickAccessActions {
  return {
    openQuickAccess: (mode) =>
      set((state) => ({
        quickAccess: {
          ...state.quickAccess,
          ...(state.quickAccess.mode
            ? {}
            : {
                ...initialQuickAccessState,
                history: state.quickAccess.history,
                openingId: state.quickAccess.openingId + 1,
                requestId: state.quickAccess.requestId + 1
              }),
          mode,
          focusRequestId: state.quickAccess.focusRequestId + 1
        }
      })),
    closeQuickAccess: () =>
      set((state) => ({
        quickAccess: {
          ...state.quickAccess,
          mode: null,
          requestId: state.quickAccess.requestId + 1,
          busy: false
        }
      })),
    updateQuickAccess: (update) =>
      set((state) => ({ quickAccess: { ...state.quickAccess, ...update } })),
    setQuickAccessServices: (services) =>
      set((state) => ({
        commands: { ...state.commands, quickAccess: services }
      }))
  };
}
