import type { EditorSearchQuery, EditorSearchStatus } from "@pluma/editor";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";

type EditorSearchPanelProps = {
  focusRequestId: number;
  isReplaceVisible: boolean;
  onClose: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onQueryChange: (query: EditorSearchQuery) => void;
  onReplaceAll: () => void;
  onReplaceNext: () => void;
  onReplaceVisibilityChange: (isVisible: boolean) => void;
  query: EditorSearchQuery;
  status: EditorSearchStatus;
};

export function EditorSearchPanel({
  focusRequestId,
  isReplaceVisible,
  onClose,
  onFindNext,
  onFindPrevious,
  onQueryChange,
  onReplaceAll,
  onReplaceNext,
  onReplaceVisibilityChange,
  query,
  status
}: EditorSearchPanelProps) {
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const restoreFindInputFocus = () => {
    window.requestAnimationFrame(() => {
      findInputRef.current?.focus();
    });
  };
  const resultText = !query.search
    ? "No results"
    : status.valid
      ? `${status.current} of ${status.total}`
      : "Invalid pattern";

  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [focusRequestId]);

  return (
    <div className="pluma-search-panel editor-search-panel" role="search">
      <div className="pluma-search-row">
        <button
          className="pluma-search-icon-button"
          onClick={() => onReplaceVisibilityChange(!isReplaceVisible)}
          type="button"
          aria-label={isReplaceVisible ? "Hide replace" : "Show replace"}
          title={isReplaceVisible ? "Hide replace" : "Show replace"}
        >
          {isReplaceVisible ? (
            <ChevronDown aria-hidden="true" size={15} />
          ) : (
            <ChevronRight aria-hidden="true" size={15} />
          )}
        </button>
        <div className="pluma-search-field">
          <input
            aria-label="Find"
            autoComplete="off"
            className="pluma-search-input"
            ref={findInputRef}
            name="search"
            onChange={(event) =>
              onQueryChange({ ...query, search: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (event.shiftKey) {
                  onFindPrevious();
                  restoreFindInputFocus();
                  return;
                }
                onFindNext();
                restoreFindInputFocus();
              }
            }}
            placeholder="Find"
            type="text"
            value={query.search}
          />
          <SearchToggle
            isPressed={query.caseSensitive}
            label="Match case"
            onClick={() =>
              onQueryChange({
                ...query,
                caseSensitive: !query.caseSensitive
              })
            }
          >
            Aa
          </SearchToggle>
          <SearchToggle
            isPressed={query.regexp}
            label="Use regular expression"
            onClick={() => onQueryChange({ ...query, regexp: !query.regexp })}
          >
            .*
          </SearchToggle>
          <SearchToggle
            isPressed={query.wholeWord}
            label="Match whole word"
            onClick={() =>
              onQueryChange({ ...query, wholeWord: !query.wholeWord })
            }
          >
            W
          </SearchToggle>
        </div>
        <span className="pluma-search-count">{resultText}</span>
        <button
          className="pluma-search-icon-button"
          onClick={onFindPrevious}
          type="button"
          aria-label="Previous match"
          title="Previous match"
        >
          <ArrowUp aria-hidden="true" size={15} />
        </button>
        <button
          className="pluma-search-icon-button"
          onClick={onFindNext}
          type="button"
          aria-label="Next match"
          title="Next match"
        >
          <ArrowDown aria-hidden="true" size={15} />
        </button>
        <button
          className="pluma-search-icon-button"
          onClick={onClose}
          type="button"
          aria-label="Close search"
          title="Close search"
        >
          <X aria-hidden="true" size={15} />
        </button>
      </div>

      {isReplaceVisible ? (
        <div className="pluma-search-row pluma-search-replace-row">
          <span />
          <input
            aria-label="Replace"
            autoComplete="off"
            className="pluma-search-input"
            name="replace"
            onChange={(event) =>
              onQueryChange({ ...query, replace: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onReplaceNext();
              }
            }}
            placeholder="Replace"
            type="text"
            value={query.replace}
          />
          <button
            className="pluma-search-text-button"
            onClick={onReplaceNext}
            type="button"
          >
            Replace
          </button>
          <button
            className="pluma-search-text-button"
            onClick={onReplaceAll}
            type="button"
          >
            Replace all
          </button>
        </div>
      ) : null}
    </div>
  );
}

type SearchToggleProps = {
  children: string;
  isPressed: boolean;
  label: string;
  onClick: () => void;
};

function SearchToggle({
  children,
  isPressed,
  label,
  onClick
}: SearchToggleProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={isPressed}
      className="pluma-search-icon-button"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
