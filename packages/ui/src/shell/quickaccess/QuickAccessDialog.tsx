import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { QuickAccessEmptyState } from "./QuickAccessEmptyState.js";
import { QuickAccessInput } from "./QuickAccessInput.js";
import { QuickAccessResult } from "./QuickAccessResult.js";
import {
  nextQuickAccessIndex,
  quickAccessOptionId,
  type QuickAccessDialogProps
} from "./quickAccessView.js";

export function QuickAccessDialog(props: QuickAccessDialogProps) {
  const {
    mode,
    query,
    rows,
    selectedId,
    busy,
    status,
    error,
    focusRequestId,
    onQueryChange,
    onSelect,
    onSubmit,
    onClose,
    onModeChange
  } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRequested = useRef(false);
  const prefix = useId();
  const listId = `${prefix}-results`;
  const [announcement, setAnnouncement] = useState("");
  const selected = rows.find((row) => row.id === selectedId);
  const activeId = selected
    ? quickAccessOptionId(prefix, selected.id)
    : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRequested.current = false;
    return () => {
      dialog?.close();
    };
  }, []);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequestId, mode]);
  useEffect(() => {
    if (activeId)
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setAnnouncement(
          error ?? (busy ? "Searching…" : status || `${rows.length} results`)
        ),
      180
    );
    return () => window.clearTimeout(timer);
  }, [busy, error, rows.length, status, query]);

  function close() {
    if (closeRequested.current) return;
    closeRequested.current = true;
    onClose();
  }
  function submit(id: string) {
    if (busy) return;
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) return;
    if (row.disabled) {
      onSelect(id);
      setAnnouncement(row.reason ?? "Not available in this context");
      return;
    }
    onSubmit(id);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)) {
      event.preventDefault();
      const index = nextQuickAccessIndex(
        rows.findIndex((row) => row.id === selectedId),
        rows.length,
        event.key
      );
      if (rows[index]) onSelect(rows[index].id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat && selectedId) submit(selectedId);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="quick-access-dialog"
      aria-label={mode === "files" ? "Quick Open" : "Command palette"}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <QuickAccessInput
        mode={mode}
        query={query}
        listId={listId}
        activeId={activeId}
        inputRef={inputRef}
        onQueryChange={onQueryChange}
        onKeyDown={handleKeyDown}
        onModeChange={onModeChange}
      />
      <div
        id={listId}
        role="listbox"
        aria-label={mode === "files" ? "Files" : "Commands"}
        aria-busy={busy}
        className="quick-access-results"
      >
        {rows.map((row) => (
          <QuickAccessResult
            key={row.id}
            row={row}
            optionId={quickAccessOptionId(prefix, row.id)}
            selected={row.id === selectedId}
            onSelect={onSelect}
            onSubmit={submit}
          />
        ))}
      </div>
      {!rows.length && !error && (
        <QuickAccessEmptyState
          mode={mode}
          query={query}
          status={error ? "" : status}
          busy={busy}
          onOpenFile={props.onOpenFile}
          onOpenFolder={props.onOpenFolder}
        />
      )}
      {error && (
        <section className="quick-access-error" aria-label="Search error">
          <span>{error}</span>
          {props.onRetry && (
            <button type="button" onClick={props.onRetry}>
              Retry
            </button>
          )}
        </section>
      )}
      {!!rows.length &&
        mode === "files" &&
        (props.onOpenFile || props.onOpenFolder) && (
          <div className="quick-access-actions quick-access-footer-actions">
            {props.onOpenFolder && (
              <button type="button" onClick={props.onOpenFolder}>
                Open Folder…
              </button>
            )}
            {props.onOpenFile && (
              <button type="button" onClick={props.onOpenFile}>
                Open File…
              </button>
            )}
          </div>
        )}
      <footer className="quick-access-footer">
        <span>{busy ? "Searching…" : status || `${rows.length} results`}</span>
        <span aria-hidden="true">
          ↑↓ Navigate · Enter {mode === "files" ? "Open" : "Run"} · Esc Close
        </span>
      </footer>
      <span
        className="quick-access-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
    </dialog>
  );
}
