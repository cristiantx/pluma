import type { FileCandidate } from "./searchTypes.js";

/** Paths retain case and spelling: identity follows the accepted workspace snapshot. */
export function deduplicateFileCandidates(
  candidates: readonly FileCandidate[]
): FileCandidate[] {
  const entries = new Map<string, FileCandidate>();
  for (const candidate of candidates) {
    const key =
      candidate.path === null
        ? `document:${candidate.documentId ?? candidate.id}`
        : `path:${candidate.path}`;
    const previous = entries.get(key);
    if (!previous) entries.set(key, candidate);
    else {
      const preferred = previous.documentId !== null ? previous : candidate;
      const recencies = [previous.recency, candidate.recency].filter(
        (value): value is number => value !== null
      );
      entries.set(key, {
        ...preferred,
        recency: recencies.length ? Math.max(...recencies) : null
      });
    }
  }
  return [...entries.values()];
}
