import type { QuickAccessMatch } from "./quickAccessView.js";

export function HighlightedMatch({
  text,
  matches = []
}: {
  text: string;
  matches?: QuickAccessMatch[] | undefined;
}) {
  const parts = [];
  let cursor = 0;
  for (const match of matches) {
    const start = Math.max(cursor, match.start);
    const end = Math.min(text.length, match.end);
    if (end <= start) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={`${start}-${end}`}>{text.slice(start, end)}</mark>);
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
