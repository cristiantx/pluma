import type { WorkspaceSearchMatch } from "../state/plumaStoreTypes.js";

export function HighlightedSearchLine({
  result
}: {
  result: WorkspaceSearchMatch;
}) {
  if (
    !Number.isFinite(result.matchStart) ||
    !Number.isFinite(result.matchEnd)
  ) {
    return (
      <span className="workspace-search-result-line">
        <span aria-hidden="true" className="workspace-search-result-ellipsis">
          ...
        </span>
        {result.lineText}
      </span>
    );
  }

  const before = result.lineText.slice(0, result.matchStart);
  const match = result.lineText.slice(result.matchStart, result.matchEnd);
  const after = result.lineText.slice(result.matchEnd);

  return (
    <span className="workspace-search-result-line">
      <span aria-hidden="true" className="workspace-search-result-ellipsis">
        ...
      </span>
      {before}
      <mark>{match}</mark>
      {after}
    </span>
  );
}
