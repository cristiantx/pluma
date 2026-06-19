import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Regex,
  Search,
  WholeWord
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { HighlightedSearchLine } from "./HighlightedSearchLine.js";
import { SearchToggle } from "./SearchToggle.js";
import {
  getWorkspaceSearchSummary,
  groupWorkspaceSearchMatches
} from "./workspaceSearchResults.js";

export const WorkspaceSearch = memo(function WorkspaceSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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

    inputRef.current?.focus();
    inputRef.current?.select();
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
          ref={inputRef}
          type="text"
          value={query}
        />
        <SearchToggle
          className="workspace-search-toggle"
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
        </SearchToggle>
        <SearchToggle
          className="workspace-search-toggle"
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
        </SearchToggle>
        <SearchToggle
          className="workspace-search-toggle"
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
        </SearchToggle>
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
