import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Regex,
  Search,
  WholeWord
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import type { WorkspaceSearchMatch } from "../state/plumaStoreTypes.js";
import {
  getWorkspaceSearchSummary,
  groupWorkspaceSearchMatches
} from "./workspaceSearchResults.js";

export const WorkspaceSearch = memo(function WorkspaceSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSequenceRef = useRef(0);
  const collapsedSearchResultFiles = usePlumaStore(
    (state) => state.workspace.collapsedSearchResultFiles
  );
  const hasSearched = usePlumaStore(
    (state) => state.workspace.searchHasSearched
  );
  const query = usePlumaStore((state) => state.workspace.searchQuery);
  const results = usePlumaStore((state) => state.workspace.searchResults);
  const searchOptions = usePlumaStore((state) => state.workspace.searchOptions);
  const searchFolderPath = usePlumaStore(
    (state) => state.workspace.searchFolderPath
  );
  const searchRequestId = usePlumaStore(
    (state) => state.workspace.searchRequestId
  );
  const searchWorkspace = usePlumaStore(
    (state) => state.commands.commandHandlers.searchWorkspace
  );
  const openWorkspaceFile = usePlumaStore(
    (state) => state.triggerOpenWorkspaceFile
  );
  const revealWorkspaceSearchMatch = usePlumaStore(
    (state) => state.revealWorkspaceSearchMatch
  );
  const setSearchHasSearched = usePlumaStore(
    (state) => state.setWorkspaceSearchHasSearched
  );
  const setSearchOptions = usePlumaStore(
    (state) => state.setWorkspaceSearchOptions
  );
  const setSearchQuery = usePlumaStore(
    (state) => state.setWorkspaceSearchQuery
  );
  const setSearchResults = usePlumaStore(
    (state) => state.setWorkspaceSearchResults
  );
  const toggleSearchResultFile = usePlumaStore(
    (state) => state.toggleWorkspaceSearchResultFile
  );
  const workspacePath = usePlumaStore((state) => state.workspace.workspacePath);
  const groupedResults = useMemo(
    () => groupWorkspaceSearchMatches(results, workspacePath),
    [results, workspacePath]
  );
  const summary = useMemo(() => getWorkspaceSearchSummary(results), [results]);

  useEffect(() => {
    if (searchRequestId === 0) {
      return;
    }

    const input = document.querySelector<HTMLInputElement>(
      ".workspace-search-input"
    );
    input?.focus();
    input?.select();
  }, [searchRequestId]);

  const runSearch = useCallback(async () => {
    const nextQuery = query.trim();
    const searchSequence = searchSequenceRef.current + 1;
    searchSequenceRef.current = searchSequence;

    if (!nextQuery) {
      setSearchResults([]);
      setError(null);
      setSearchHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchHasSearched(true);

    try {
      const nextResults = await searchWorkspace(
        nextQuery,
        searchFolderPath,
        searchOptions
      );
      if (searchSequenceRef.current !== searchSequence) {
        return;
      }
      setSearchResults(nextResults);
    } catch (searchError) {
      if (searchSequenceRef.current !== searchSequence) {
        return;
      }
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Workspace search failed."
      );
      setSearchResults([]);
    } finally {
      if (searchSequenceRef.current === searchSequence) {
        setIsSearching(false);
      }
    }
  }, [
    query,
    searchFolderPath,
    searchOptions,
    searchWorkspace,
    setSearchHasSearched,
    setSearchResults
  ]);

  useEffect(() => {
    if (!query.trim()) {
      searchSequenceRef.current += 1;
      setSearchResults([]);
      setError(null);
      setSearchHasSearched(false);
      setIsSearching(false);
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      void runSearch();
    }, 200);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [
    query,
    runSearch,
    searchOptions.caseSensitive,
    searchOptions.regexp,
    searchOptions.wholeWord,
    setSearchHasSearched,
    setSearchResults
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch();
  };

  return (
    <section className="workspace-search" aria-label="Workspace search">
      <form className="workspace-search-form" onSubmit={handleSubmit}>
        <Search aria-hidden="true" className="workspace-search-icon" />
        <input
          aria-label="Search Markdown files"
          className="workspace-search-input"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search Markdown"
          type="text"
          value={query}
        />
        <WorkspaceSearchToggle
          isPressed={searchOptions.caseSensitive}
          label={
            searchOptions.caseSensitive ? "Case sensitive" : "Case insensitive"
          }
          onClick={() =>
            setSearchOptions({
              ...searchOptions,
              caseSensitive: !searchOptions.caseSensitive
            })
          }
        >
          <CaseSensitive aria-hidden="true" />
        </WorkspaceSearchToggle>
        <WorkspaceSearchToggle
          isPressed={searchOptions.regexp}
          label="Use regular expression"
          onClick={() =>
            setSearchOptions({
              ...searchOptions,
              regexp: !searchOptions.regexp
            })
          }
        >
          <Regex aria-hidden="true" />
        </WorkspaceSearchToggle>
        <WorkspaceSearchToggle
          isPressed={searchOptions.wholeWord}
          label="Match whole word"
          onClick={() =>
            setSearchOptions({
              ...searchOptions,
              wholeWord: !searchOptions.wholeWord
            })
          }
        >
          <WholeWord aria-hidden="true" />
        </WorkspaceSearchToggle>
      </form>
      {error ? <div className="workspace-search-error">{error}</div> : null}
      {results.length > 0 ? (
        <div className="workspace-search-results">
          <div className="workspace-search-summary">{summary}</div>
          {groupedResults.map((group) => {
            const isCollapsed = collapsedSearchResultFiles.includes(
              group.filePath
            );
            const CaretIcon = isCollapsed ? ChevronRight : ChevronDown;

            return (
              <section className="workspace-search-group" key={group.filePath}>
                <button
                  aria-expanded={!isCollapsed}
                  className="workspace-search-group-header"
                  onClick={() => toggleSearchResultFile(group.filePath)}
                  type="button"
                >
                  <CaretIcon
                    aria-hidden="true"
                    className="workspace-search-group-caret"
                  />
                  <span className="workspace-search-group-label">
                    {group.label}
                  </span>
                  <span className="workspace-search-group-count">
                    {group.matches.length}
                  </span>
                </button>
                {isCollapsed
                  ? null
                  : group.matches.map((result) => (
                      <button
                        className="workspace-search-result"
                        key={`${result.filePath}:${result.line}:${result.matchStart}:${result.matchEnd}`}
                        onClick={() => {
                          revealWorkspaceSearchMatch(result);
                          openWorkspaceFile(result.filePath);
                        }}
                        type="button"
                      >
                        <HighlightedSearchLine result={result} />
                      </button>
                    ))}
              </section>
            );
          })}
        </div>
      ) : hasSearched || isSearching ? (
        <div className="workspace-search-empty">
          {isSearching ? "Searching..." : "No matches"}
        </div>
      ) : null}
    </section>
  );
});

type WorkspaceSearchToggleProps = {
  children: ReactNode;
  isPressed: boolean;
  label: string;
  onClick: () => void;
};

function WorkspaceSearchToggle({
  children,
  isPressed,
  label,
  onClick
}: WorkspaceSearchToggleProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={isPressed}
      className="workspace-search-toggle"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function HighlightedSearchLine({ result }: { result: WorkspaceSearchMatch }) {
  if (
    !Number.isFinite(result.matchStart) ||
    !Number.isFinite(result.matchEnd)
  ) {
    return (
      <span className="workspace-search-result-line">
        <span aria-hidden="true" className="workspace-search-result-ellipsis">
          ...
        </span>
        {result.lineText}
      </span>
    );
  }

  const before = result.lineText.slice(0, result.matchStart);
  const match = result.lineText.slice(result.matchStart, result.matchEnd);
  const after = result.lineText.slice(result.matchEnd);

  return (
    <span className="workspace-search-result-line">
      <span aria-hidden="true" className="workspace-search-result-ellipsis">
        ...
      </span>
      {before}
      <mark>{match}</mark>
      {after}
    </span>
  );
}
