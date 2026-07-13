import type {
  WorkspaceSearchMatch,
  WorkspaceSearchOptions,
  WorkspaceSlice
} from "./plumaStoreTypes.js";

export function openWorkspaceSearchState(
  workspace: WorkspaceSlice,
  folderPath: string | null
): WorkspaceSlice {
  return {
    ...workspace,
    searchFolderPath: folderPath,
    searchRequestId: workspace.searchRequestId + 1,
    sidebarView: "search"
  };
}

export function revealWorkspaceFileState(
  workspace: WorkspaceSlice,
  path: string
): WorkspaceSlice {
  return {
    ...workspace,
    revealRequestId: workspace.revealRequestId + 1,
    revealWorkspacePath: path
  };
}

export function revealWorkspaceSearchMatchState(
  workspace: WorkspaceSlice,
  match: WorkspaceSearchMatch
): WorkspaceSlice {
  return {
    ...workspace,
    searchRevealRequest: {
      match,
      requestId: (workspace.searchRevealRequest?.requestId ?? 0) + 1
    }
  };
}

export function setWorkspaceSearchResultsState(
  workspace: WorkspaceSlice,
  results: WorkspaceSearchMatch[]
): WorkspaceSlice {
  const resultPaths = new Set(results.map((result) => result.filePath));

  return {
    ...workspace,
    collapsedSearchResultFiles: workspace.collapsedSearchResultFiles.filter(
      (filePath) => resultPaths.has(filePath)
    ),
    searchResults: results
  };
}

export function setWorkspaceSearchOptionsState(
  workspace: WorkspaceSlice,
  options: WorkspaceSearchOptions
): WorkspaceSlice {
  return { ...workspace, searchOptions: options };
}

export function toggleWorkspaceSearchResultFileState(
  workspace: WorkspaceSlice,
  filePath: string
): WorkspaceSlice {
  const isCollapsed = workspace.collapsedSearchResultFiles.includes(filePath);

  return {
    ...workspace,
    collapsedSearchResultFiles: isCollapsed
      ? workspace.collapsedSearchResultFiles.filter(
          (candidate) => candidate !== filePath
        )
      : [...workspace.collapsedSearchResultFiles, filePath]
  };
}
