import { useEffect, useMemo } from "react";
import { getPaletteEntries, getCommandShortcutLabel } from "@pluma/commands";
import {
  matchSearchText,
  prepareSearchText,
  mergeMatchRanges
} from "@pluma/core";
import { usePlumaStore } from "../../state/usePlumaStore.js";
import { QuickAccessDialog } from "./QuickAccessDialog.js";
import type { QuickAccessRow } from "./quickAccessView.js";
import { quickAccessContext } from "./quickAccessContext.js";
import { useQuickAccessFiles } from "./useQuickAccessFiles.js";
import { useQuickAccessFocus } from "./useQuickAccessFocus.js";
import { useQuickAccessExecution } from "./useQuickAccessExecution.js";

export function QuickAccess() {
  const access = usePlumaStore((state) => state.quickAccess);
  const services = usePlumaStore((state) => state.commands.quickAccess);
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const index = usePlumaStore((state) => state.workspace.workspaceIndex);
  const context = usePlumaStore((state) =>
    JSON.stringify(quickAccessContext(state))
  );
  const open = usePlumaStore((state) => state.openQuickAccess);
  const close = usePlumaStore((state) => state.closeQuickAccess);
  const update = usePlumaStore((state) => state.updateQuickAccess);
  const restore = useQuickAccessFocus(access.openingId, access.mode !== null);
  const execute = useQuickAccessExecution(restore);
  useQuickAccessFiles();
  const platform =
    services?.platform ??
    (navigator.platform.includes("Mac") ? "darwin" : "linux");
  useEffect(() => {
    services?.setOpen(access.mode !== null);
    return () => {
      services?.setOpen(false);
    };
  }, [Boolean(access.mode), services]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const modifier = platform === "darwin" ? event.metaKey : event.ctrlKey;
      if (modifier && !event.altKey && event.key.toLowerCase() === "p") {
        if (!services?.nativeAccelerators) {
          event.preventDefault();
          open(event.shiftKey ? "commands" : "files");
        }
        return;
      }
      if (
        usePlumaStore.getState().quickAccess.mode &&
        modifier &&
        !["a", "c", "v", "x", "z"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [open, platform, services]);
  const rows = useMemo((): QuickAccessRow[] => {
    if (access.mode === "files")
      return access.results.map(({ candidate, nameMatches, pathMatches }) => ({
        id: candidate.id,
        label: candidate.name,
        description: candidate.relativePath,
        badge: candidate.documentId
          ? "Open"
          : candidate.recency !== null
            ? "Recent"
            : "",
        labelMatches: nameMatches,
        descriptionMatches: pathMatches
      }));
    const tokens = access.queries.commands
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => prepareSearchText(token).characters);
    return getPaletteEntries(JSON.parse(context)).flatMap((entry) => {
      const label = prepareSearchText(entry.label);
      const aliases = prepareSearchText(
        `${entry.category} ${entry.keywords.join(" ")}`
      );
      const matches = tokens.map((token) => matchSearchText(label, token));
      if (
        matches.some(
          (match, index) => !match && !matchSearchText(aliases, tokens[index]!)
        )
      )
        return [];
      return [
        {
          id: entry.key,
          label: entry.label,
          description: entry.reason ?? entry.category,
          shortcut: getCommandShortcutLabel(entry.commandId, platform),
          disabled: !entry.enabled,
          ...(entry.reason ? { reason: entry.reason } : {}),
          ...(entry.checked === undefined ? {} : { checked: entry.checked }),
          labelMatches: mergeMatchRanges(
            matches.flatMap((match) => match?.ranges ?? [])
          )
        }
      ];
    });
  }, [access.mode, access.results, access.queries.commands, context, platform]);
  const mode = access.mode;
  const selected = mode ? access.selections[mode] : null;
  useEffect(() => {
    if (mode === "commands" && !rows.some((row) => row.id === selected))
      update({
        selections: {
          ...usePlumaStore.getState().quickAccess.selections,
          commands: rows[0]?.id ?? null
        }
      });
  }, [mode, rows, selected, update]);
  if (!mode) return null;
  const status =
    mode === "commands"
      ? `${rows.length} commands`
      : index?.status === "loading"
        ? "Scanning workspace…"
        : access.total > 50
          ? `Showing 50 of ${access.total}; keep typing`
          : !hasWorkspace && !rows.length
            ? "Open a folder to search its Markdown files."
            : !rows.length
              ? access.queries.files
                ? `No files match “${access.queries.files}”`
                : "No Markdown files in this folder."
              : `${access.total} files`;
  return (
    <QuickAccessDialog
      mode={mode}
      query={access.queries[mode]}
      rows={rows}
      selectedId={selected}
      status={status}
      error={access.error ?? (mode === "files" ? (index?.error ?? null) : null)}
      busy={access.executing || (mode === "files" && access.busy)}
      focusRequestId={access.focusRequestId}
      onClose={() => {
        close();
        restore();
      }}
      onModeChange={open}
      onSelect={(id) =>
        update({ selections: { ...access.selections, [mode]: id } })
      }
      onSubmit={(id) => {
        void execute(id);
      }}
      onQueryChange={(query) => {
        if (mode === "files" && query.startsWith(">")) {
          open("commands");
          update({ queries: { ...access.queries, commands: query.slice(1) } });
        } else if (mode === "commands" && !query.startsWith(">")) open("files");
        else
          update({
            queries: {
              ...access.queries,
              [mode]: mode === "commands" ? query.slice(1) : query
            },
            error: null
          });
      }}
      {...(!hasWorkspace
        ? {
            onOpenFolder: () => {
              void execute("open-folder", true);
            },
            onOpenFile: () => {
              void execute("open-file", true);
            }
          }
        : {})}
      onRetry={() => {
        void services?.refresh();
        update({
          error: null,
          requestId: access.requestId + 1,
          focusRequestId: access.focusRequestId + 1
        });
        open("files");
      }}
    />
  );
}
