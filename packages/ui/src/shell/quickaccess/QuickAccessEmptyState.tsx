import type { QuickAccessMode } from "./quickAccessView.js";

export function QuickAccessEmptyState({
  mode,
  query,
  status,
  busy,
  onOpenFile,
  onOpenFolder
}: {
  mode: QuickAccessMode;
  query: string;
  status: string;
  busy: boolean;
  onOpenFile?: (() => void) | undefined;
  onOpenFolder?: (() => void) | undefined;
}) {
  const message = busy
    ? "Searching…"
    : status ||
      (query
        ? `No ${mode === "files" ? "files" : "commands"} match “${query}”.`
        : mode === "files"
          ? "Open a folder to search its Markdown files."
          : "No commands available.");
  return (
    <section className="quick-access-empty" aria-label="Search results">
      <p>{message}</p>
      {mode === "files" && (
        <div className="quick-access-actions">
          {onOpenFolder && (
            <button type="button" onClick={onOpenFolder}>
              Open Folder…
            </button>
          )}
          {onOpenFile && (
            <button type="button" onClick={onOpenFile}>
              Open File…
            </button>
          )}
        </div>
      )}
    </section>
  );
}
