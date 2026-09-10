import { deduplicateFileCandidates, type FileCandidate } from "@pluma/core";
import type { PlumaTab } from "../../adapters/tabModel.js";
import type { ExplorerNode } from "../types.js";

export function buildQuickAccessCandidates(
  tabs: PlumaTab[],
  nodes: ExplorerNode[],
  workspacePath: string | null,
  history: Record<string, number>
): FileCandidate[] {
  const root = workspacePath?.replaceAll("\\", "/").replace(/\/$/, "");
  const relative = (path: string) => {
    const normalized = path.replaceAll("\\", "/");
    return root && normalized.startsWith(`${root}/`)
      ? normalized.slice(root.length + 1)
      : path;
  };
  const open = tabs
    .filter((tab) => tab.kind === "document")
    .map((tab): FileCandidate => {
      const path =
        "location" in tab && tab.location?.kind === "desktop-path"
          ? tab.location.path
          : null;
      return {
        id: tab.id,
        name: tab.title,
        path,
        relativePath: path ? relative(path) : "Unsaved document",
        documentId: tab.id,
        recency: history[tab.id] ?? (path ? history[path] : undefined) ?? null
      };
    });
  const files = nodes
    .filter((node) => node.kind === "file")
    .map(
      (node): FileCandidate => ({
        id: node.id,
        name: node.label,
        path: node.id,
        relativePath: relative(node.id),
        documentId: null,
        recency: history[node.id] ?? null
      })
    );
  return deduplicateFileCandidates([...open, ...files]);
}
