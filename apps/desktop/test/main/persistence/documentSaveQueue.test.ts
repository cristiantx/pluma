import { describe, expect, it, vi } from "vitest";

import { DocumentSaveQueue } from "../../../src/main/persistence/documentSaveQueue";

describe("DocumentSaveQueue", () => {
  it("serializes saves for the same document without blocking another", async () => {
    let releaseFirstSave: (() => void) | null = null;
    const queue = new DocumentSaveQueue();
    const firstOperation = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          releaseFirstSave = () => resolve(true);
        })
    );
    const secondOperation = vi.fn(async () => true);
    const otherDocumentOperation = vi.fn(async () => true);

    const firstSave = queue.enqueue("first", firstOperation);
    const secondSave = queue.enqueue("first", secondOperation);
    const otherSave = queue.enqueue("other", otherDocumentOperation);

    await otherSave;
    expect(otherDocumentOperation).toHaveBeenCalledOnce();
    expect(secondOperation).not.toHaveBeenCalled();

    releaseFirstSave?.();
    await Promise.all([firstSave, secondSave]);
    expect(secondOperation).toHaveBeenCalledOnce();
  });
});
