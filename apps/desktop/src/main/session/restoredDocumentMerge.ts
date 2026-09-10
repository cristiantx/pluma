import type { DocumentSession } from "@pluma/core";

/** Tracks removals between restore publications without owning live documents. */
export class RestoredDocumentMerge {
  private publishedIds = new Set<string>();
  private readonly removedIds = new Set<string>();

  record(documents: DocumentSession[]): void {
    this.publishedIds = new Set(documents.map((document) => document.id));
  }

  merge(
    restored: DocumentSession[],
    current: DocumentSession[]
  ): DocumentSession[] {
    const live = new Map(current.map((document) => [document.id, document]));
    for (const id of this.publishedIds) {
      if (!live.has(id)) this.removedIds.add(id);
    }
    const merged = restored
      .filter((document) => !this.removedIds.has(document.id))
      .map((document) => live.get(document.id) ?? document);
    const included = new Set(merged.map((document) => document.id));
    merged.push(...current.filter((document) => !included.has(document.id)));
    this.record(merged);
    return merged;
  }
}
