import type { WorkspaceSearchMatch } from "../state/plumaStoreTypes.js";

export type WorkspaceSearchGroup = {
  filePath: string;
  label: string;
  matches: WorkspaceSearchMatch[];
};

export function groupWorkspaceSearchMatches(
  matches: WorkspaceSearchMatch[],
  workspacePath: string
): WorkspaceSearchGroup[] {
  const groups = new Map<string, WorkspaceSearchGroup>();

  for (const match of matches) {
    const existing = groups.get(match.filePath);

    if (existing) {
      existing.matches.push(match);
      continue;
    }

    groups.set(match.filePath, {
      filePath: match.filePath,
      label: getWorkspaceRelativeLabel(match.filePath, workspacePath),
      matches: [match]
    });
  }

  return [...groups.values()];
}

export function getWorkspaceRelativeLabel(
  filePath: string,
  workspacePath: string
): string {
  return filePath.startsWith(workspacePath)
    ? filePath.slice(workspacePath.length).replace(/^[/\\]/, "")
    : filePath;
}

export function getWorkspaceSearchSummary(
  matches: WorkspaceSearchMatch[]
): string {
  const fileCount = new Set(matches.map((match) => match.filePath)).size;
  const matchLabel = matches.length === 1 ? "match" : "matches";
  const fileLabel = fileCount === 1 ? "file" : "files";

  return `${matches.length} ${matchLabel} in ${fileCount} ${fileLabel}`;
}
