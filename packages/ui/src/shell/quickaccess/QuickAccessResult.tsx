import { HighlightedMatch } from "./HighlightedMatch.js";
import type { QuickAccessRow } from "./quickAccessView.js";

export function QuickAccessResult({
  row,
  optionId,
  selected,
  onSelect,
  onSubmit
}: {
  row: QuickAccessRow;
  optionId: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onSubmit: (id: string) => void;
}) {
  const name = [
    row.label,
    row.description,
    row.badge,
    row.checked ? "Enabled" : "",
    row.disabled
      ? `Unavailable: ${row.reason ?? "Not available in this context"}`
      : "",
    row.shortcut
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      role="option"
      id={optionId}
      tabIndex={-1}
      className="quick-access-result"
      aria-selected={selected}
      aria-disabled={row.disabled || undefined}
      aria-label={name}
      title={[row.label, row.description, row.reason]
        .filter(Boolean)
        .join("\n")}
      onPointerDown={(event) => event.preventDefault()}
      onPointerMove={() => onSelect(row.id)}
      onClick={() => onSubmit(row.id)}
    >
      <span className="quick-access-result-copy">
        <span className="quick-access-result-label">
          {row.checked && <span aria-hidden="true">✓ </span>}
          <HighlightedMatch text={row.label} matches={row.labelMatches} />
        </span>
        <span className="quick-access-result-description">
          <HighlightedMatch
            text={row.reason ?? row.description}
            matches={row.reason ? [] : row.descriptionMatches}
          />
        </span>
      </span>
      {row.badge && <span className="quick-access-badge">{row.badge}</span>}
      {row.shortcut && <kbd>{row.shortcut}</kbd>}
    </button>
  );
}
