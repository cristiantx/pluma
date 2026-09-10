import {
  getPaletteEntries,
  getCommandShortcutLabel,
  type CommandContext,
  type CommandPlatform
} from "@pluma/commands";
import {
  prepareSearchText,
  matchSearchText,
  mergeMatchRanges
} from "@pluma/core";
import type { QuickAccessRow } from "./quickAccessView.js";

export function getQuickAccessCommandRows(
  context: CommandContext,
  query: string,
  platform: CommandPlatform
): QuickAccessRow[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => prepareSearchText(token).characters);
  const phrase = prepareSearchText(query.trim()).characters;
  return getPaletteEntries(context)
    .flatMap((entry) => {
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
      const rank = tokens.length
        ? (matchSearchText(label, phrase)?.tier ?? 4)
        : 0;
      const row: QuickAccessRow = {
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
      };
      return [{ row, rank }];
    })
    .sort(
      (a, b) =>
        a.rank - b.rank || Number(a.row.disabled) - Number(b.row.disabled)
    )
    .map(({ row }) => row);
}
