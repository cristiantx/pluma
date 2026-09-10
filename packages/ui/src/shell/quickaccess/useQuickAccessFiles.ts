import { useEffect, useMemo, useRef } from "react";
import { searchFiles } from "@pluma/core";
import { usePlumaStore } from "../../state/usePlumaStore.js";
import { buildQuickAccessCandidates } from "./quickAccessCandidates.js";

export function useQuickAccessFiles() {
  const mode = usePlumaStore((state) => state.quickAccess.mode);
  const focusRequestId = usePlumaStore(
    (state) => state.quickAccess.focusRequestId
  );
  const openingId = usePlumaStore((state) => state.quickAccess.openingId);
  const query = usePlumaStore((state) => state.quickAccess.queries.files);
  const metadata = usePlumaStore((state) =>
    JSON.stringify(
      state.tabs.tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        kind: tab.kind,
        location: "location" in tab ? tab.location : undefined
      }))
    )
  );
  const nodes = usePlumaStore((state) => state.workspace.explorerNodes);
  const root = usePlumaStore((state) =>
    state.workspace.hasWorkspace ? state.workspace.workspacePath : null
  );
  const generation = usePlumaStore(
    (state) => state.workspace.workspaceIndex?.generation ?? 0
  );
  const revision = usePlumaStore(
    (state) => state.workspace.workspaceIndex?.revision ?? 0
  );
  const activeId = usePlumaStore((state) => state.tabs.activeTabId);
  const history = usePlumaStore((state) => state.quickAccess.history);
  const services = usePlumaStore((state) => state.commands.quickAccess);
  const update = usePlumaStore((state) => state.updateQuickAccess);
  const previousActive = useRef("");
  useEffect(() => {
    if (
      !activeId ||
      activeId === "settings" ||
      previousActive.current === activeId
    )
      return;
    previousActive.current = activeId;
    const state = usePlumaStore.getState();
    const document = state.document.documents.find(
      (item) => item.id === activeId
    );
    const next = Math.max(0, ...Object.values(state.quickAccess.history)) + 1;
    const entries = Object.entries({
      ...state.quickAccess.history,
      [activeId]: next,
      ...(document?.location.kind === "desktop-path"
        ? { [document.location.path]: next }
        : {})
    })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    update({ history: Object.fromEntries(entries) });
  }, [activeId, update]);
  const candidates = useMemo(
    () =>
      buildQuickAccessCandidates(JSON.parse(metadata), nodes, root, history),
    [metadata, nodes, root, history]
  );
  useEffect(() => {
    if (mode !== "files") return;
    const id = usePlumaStore.getState().quickAccess.requestId + 1;
    const previousQuery = usePlumaStore.getState().quickAccess.resultsQuery;
    update({
      requestId: id,
      busy: true,
      ...(previousQuery === query
        ? {}
        : {
            selections: {
              ...usePlumaStore.getState().quickAccess.selections,
              files: null
            }
          })
    });
    let cancelled = false;
    const current = () =>
      !cancelled &&
      usePlumaStore.getState().quickAccess.mode === "files" &&
      usePlumaStore.getState().quickAccess.requestId === id;
    const search =
      services?.search(candidates, query) ??
      Promise.resolve(searchFiles(candidates, query));
    void search
      .then(({ results, total }) => {
        if (!current()) return;
        const selection = usePlumaStore.getState().quickAccess.selections.files;
        update({
          results,
          resultsQuery: query,
          total,
          busy: false,
          selections: {
            ...usePlumaStore.getState().quickAccess.selections,
            files: results.some((row) => row.candidate.id === selection)
              ? selection
              : (results[0]?.candidate.id ?? null)
          }
        });
      })
      .catch((error: unknown) => {
        if (
          !current() ||
          (error instanceof Error && error.name === "AbortError")
        )
          return;
        update({
          busy: false,
          results: [],
          total: 0,
          error: error instanceof Error ? error.message : "File search failed."
        });
      });
    return () => {
      cancelled = true;
    };
  }, [
    mode,
    openingId,
    focusRequestId,
    query,
    candidates,
    generation,
    revision,
    services,
    update
  ]);
}
