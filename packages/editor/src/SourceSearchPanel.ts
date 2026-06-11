import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery
} from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import {
  runScopeHandlers,
  type Panel,
  type EditorView,
  type ViewUpdate
} from "@codemirror/view";
import { __iconNode as arrowDownIcon } from "lucide-react/dist/esm/icons/arrow-down.mjs";
import { __iconNode as arrowUpIcon } from "lucide-react/dist/esm/icons/arrow-up.mjs";
import { __iconNode as caseSensitiveIcon } from "lucide-react/dist/esm/icons/case-sensitive.mjs";
import { __iconNode as chevronDownIcon } from "lucide-react/dist/esm/icons/chevron-down.mjs";
import { __iconNode as chevronRightIcon } from "lucide-react/dist/esm/icons/chevron-right.mjs";
import { __iconNode as regexIcon } from "lucide-react/dist/esm/icons/regex.mjs";
import { __iconNode as wholeWordIcon } from "lucide-react/dist/esm/icons/whole-word.mjs";
import { __iconNode as xIcon } from "lucide-react/dist/esm/icons/x.mjs";

export function createSourceSearchPanel(view: EditorView): Panel {
  return new SourceSearchPanel(view);
}

class SourceSearchPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;
  private readonly caseButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly collapseButton: HTMLButtonElement;
  private readonly countElement: HTMLElement;
  private readonly findInput: HTMLInputElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly previousButton: HTMLButtonElement;
  private readonly regexpButton: HTMLButtonElement;
  private readonly replaceAllButton: HTMLButtonElement;
  private readonly replaceButton: HTMLButtonElement;
  private readonly replaceInput: HTMLInputElement;
  private readonly replaceRow: HTMLElement;
  private readonly wholeWordButton: HTMLButtonElement;
  private isCollapsed = false;
  private query: SearchQuery;

  constructor(private readonly view: EditorView) {
    this.query = getSearchQuery(view.state);
    this.findInput = createInput("Find", "search", this.query.search);
    this.replaceInput = createInput("Replace", "replace", this.query.replace);
    this.collapseButton = createIconButton(
      "Collapse replace",
      chevronDownIcon,
      () => {
        this.setCollapsed(!this.isCollapsed);
      }
    );
    this.caseButton = createIconButton("Match case", caseSensitiveIcon, () => {
      this.updateQuery({ caseSensitive: !this.query.caseSensitive });
    });
    this.regexpButton = createIconButton(
      "Use regular expression",
      regexIcon,
      () => {
        this.updateQuery({ regexp: !this.query.regexp });
      }
    );
    this.wholeWordButton = createIconButton(
      "Match whole word",
      wholeWordIcon,
      () => {
        this.updateQuery({ wholeWord: !this.query.wholeWord });
      }
    );
    this.previousButton = createIconButton(
      "Previous match",
      arrowUpIcon,
      () => {
        findPrevious(this.view);
        this.updateCount();
      }
    );
    this.nextButton = createIconButton("Next match", arrowDownIcon, () => {
      findNext(this.view);
      this.updateCount();
    });
    this.closeButton = createIconButton("Close search", xIcon, () => {
      closeSearchPanel(this.view);
    });
    this.replaceButton = createTextButton("Replace", () => {
      replaceNext(this.view);
      this.updateCount();
    });
    this.replaceAllButton = createTextButton("Replace all", () => {
      replaceAll(this.view);
      this.updateCount();
    });
    this.countElement = document.createElement("span");
    this.countElement.className = "pluma-search-count";

    this.findInput.addEventListener("input", () => this.commit());
    this.replaceInput.addEventListener("input", () => this.commit());

    const searchField = document.createElement("div");
    searchField.className = "pluma-search-field";
    searchField.append(
      this.findInput,
      this.caseButton,
      this.regexpButton,
      this.wholeWordButton
    );

    const searchRow = document.createElement("div");
    searchRow.className = "pluma-search-row";
    searchRow.append(
      this.collapseButton,
      searchField,
      this.countElement,
      this.previousButton,
      this.nextButton,
      this.closeButton
    );

    this.replaceRow = document.createElement("div");
    this.replaceRow.className = "pluma-search-row pluma-search-replace-row";
    this.replaceRow.append(
      document.createElement("span"),
      this.replaceInput,
      this.replaceButton,
      this.replaceAllButton
    );

    this.dom = document.createElement("div");
    this.dom.className = "pluma-search-panel";
    this.dom.addEventListener("keydown", (event) => this.handleKeydown(event));
    this.dom.append(searchRow, this.replaceRow);
    this.syncToggleButtonState();
    this.updateCount();
  }

  mount(): void {
    this.findInput.select();
  }

  update(update: ViewUpdate): void {
    let shouldUpdateCount = update.docChanged || update.selectionSet;

    for (const transaction of update.transactions) {
      for (const effect of transaction.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value);
          shouldUpdateCount = true;
        }
      }
    }

    if (shouldUpdateCount) {
      this.updateCount();
    }
  }

  private commit(): void {
    this.updateQuery({
      replace: this.replaceInput.value,
      search: this.findInput.value
    });
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (runScopeHandlers(this.view, event, "search-panel")) {
      event.preventDefault();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (event.target === this.replaceInput) {
      replaceNext(this.view);
      this.updateCount();
      return;
    }

    (event.shiftKey ? findPrevious : findNext)(this.view);
    this.updateCount();
  }

  private setCollapsed(isCollapsed: boolean): void {
    this.isCollapsed = isCollapsed;
    this.dom.dataset.collapsed = String(isCollapsed);
    setButtonIcon(
      this.collapseButton,
      isCollapsed ? chevronRightIcon : chevronDownIcon
    );
    this.collapseButton.setAttribute(
      "aria-label",
      isCollapsed ? "Show replace" : "Hide replace"
    );
    this.collapseButton.title = isCollapsed ? "Show replace" : "Hide replace";
  }

  private setQuery(query: SearchQuery): void {
    this.query = query;
    this.findInput.value = query.search;
    this.replaceInput.value = query.replace;
    this.syncToggleButtonState();
  }

  private syncToggleButtonState(): void {
    setToggleButtonState(
      this.caseButton,
      this.query.caseSensitive,
      this.query.caseSensitive ? "Case sensitive" : "Case insensitive"
    );
    setToggleButtonState(
      this.regexpButton,
      this.query.regexp,
      this.query.regexp ? "Regex search" : "Plain text search"
    );
    setToggleButtonState(
      this.wholeWordButton,
      this.query.wholeWord,
      this.query.wholeWord ? "Whole word" : "Partial word"
    );
  }

  private updateCount(): void {
    const count = countMatches(this.view.state, this.query);
    this.countElement.textContent =
      this.query.search && this.query.valid
        ? `${count.current} of ${count.total}`
        : "No results";
  }

  private updateQuery(update: Partial<SearchQueryConfig>): void {
    const query = new SearchQuery({
      caseSensitive: update.caseSensitive ?? this.query.caseSensitive,
      regexp: update.regexp ?? this.query.regexp,
      replace: update.replace ?? this.query.replace,
      search: update.search ?? this.query.search,
      wholeWord: update.wholeWord ?? this.query.wholeWord
    });

    if (query.eq(this.query)) {
      return;
    }

    this.query = query;
    this.syncToggleButtonState();
    this.view.dispatch({ effects: setSearchQuery.of(query) });
    this.updateCount();
  }
}

type SearchQueryConfig = {
  caseSensitive: boolean;
  regexp: boolean;
  replace: string;
  search: string;
  wholeWord: boolean;
};

type LucideIconNode = [string, Record<string, string>][];

function countMatches(
  state: EditorState,
  query: SearchQuery
): { current: number; total: number } {
  if (!query.search || !query.valid) {
    return { current: 0, total: 0 };
  }

  const cursor = query.getCursor(state);
  const selectionHead = state.selection.main.head;
  let current = 0;
  let index = 0;
  let firstAfterSelection = 0;

  for (let match = cursor.next(); !match.done; match = cursor.next()) {
    index += 1;

    if (
      current === 0 &&
      match.value.from <= selectionHead &&
      match.value.to >= selectionHead
    ) {
      current = index;
    }

    if (firstAfterSelection === 0 && match.value.from >= selectionHead) {
      firstAfterSelection = index;
    }
  }

  return {
    current: current || firstAfterSelection || (index > 0 ? 1 : 0),
    total: index
  };
}

function createIconButton(
  label: string,
  iconNode: LucideIconNode,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pluma-search-icon-button";
  button.setAttribute("aria-label", label);
  button.title = label;
  setButtonIcon(button, iconNode);
  button.addEventListener("click", onClick);

  return button;
}

function createLucideSvg(iconNode: LucideIconNode): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  for (const [tag, attrs] of iconNode) {
    const child = document.createElementNS("http://www.w3.org/2000/svg", tag);

    for (const [name, value] of Object.entries(attrs)) {
      if (name !== "key") {
        child.setAttribute(name, value);
      }
    }

    svg.append(child);
  }

  return svg;
}

function setButtonIcon(
  button: HTMLButtonElement,
  iconNode: LucideIconNode
): void {
  button.replaceChildren(createLucideSvg(iconNode));
}

function createInput(
  label: string,
  name: string,
  value: string
): HTMLInputElement {
  const input = document.createElement("input");
  input.setAttribute("aria-label", label);
  input.setAttribute("main-field", name === "search" ? "true" : "false");
  input.autocomplete = "off";
  input.className = "pluma-search-input";
  input.name = name;
  input.placeholder = label;
  input.type = "text";
  input.value = value;

  return input;
}

function createTextButton(
  label: string,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pluma-search-text-button";
  button.textContent = label;
  button.addEventListener("click", onClick);

  return button;
}

function setToggleButtonState(
  button: HTMLButtonElement,
  isPressed: boolean,
  label: string
) {
  button.setAttribute("aria-pressed", String(isPressed));
  button.setAttribute("aria-label", label);
  button.title = label;
}
