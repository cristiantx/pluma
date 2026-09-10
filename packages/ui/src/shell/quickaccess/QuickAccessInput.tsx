import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject
} from "react";
import type { QuickAccessMode } from "./quickAccessView.js";

export function QuickAccessInput({
  mode,
  query,
  listId,
  activeId,
  inputRef,
  onQueryChange,
  onKeyDown,
  onModeChange
}: {
  mode: QuickAccessMode;
  query: string;
  listId: string;
  activeId?: string | undefined;
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onModeChange: (mode: QuickAccessMode) => void;
}) {
  const displayed = mode === "commands" ? `>${query}` : query;
  const [value, setValue] = useState(displayed);
  const composing = useRef(false);
  useEffect(() => {
    if (!composing.current) setValue(displayed);
  }, [displayed]);
  return (
    <header className="quick-access-header">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-label={mode === "files" ? "Search files" : "Search commands"}
        placeholder={
          mode === "files" ? "Search files by name or path" : "Search commands"
        }
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (!composing.current) onQueryChange(event.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          onQueryChange(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (!composing.current) onKeyDown(event);
        }}
      />
      <button
        type="button"
        className="quick-access-mode"
        aria-label={mode === "files" ? "Switch to commands" : "Switch to files"}
        onClick={() => onModeChange(mode === "files" ? "commands" : "files")}
      >
        {mode === "files" ? "Commands" : "Files"}
      </button>
    </header>
  );
}
