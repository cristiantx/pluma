import { afterEach, describe, expect, it, vi } from "vitest";

import {
  documentTextSyncDelayMs,
  PendingDocumentTextSync
} from "../../src/preload/documentTextSync";

describe("PendingDocumentTextSync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends only the latest text after the debounce interval", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const sync = new PendingDocumentTextSync(send);

    sync.schedule("doc-1", "a");
    vi.advanceTimersByTime(documentTextSyncDelayMs - 1);
    sync.schedule("doc-1", "ab");
    vi.advanceTimersByTime(documentTextSyncDelayMs);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("doc-1", "ab");
  });

  it("flushes every pending document immediately and cancels the timer", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const sync = new PendingDocumentTextSync(send);

    sync.schedule("doc-1", "latest one");
    sync.schedule("doc-2", "latest two");
    sync.flush();
    vi.runAllTimers();

    expect(send.mock.calls).toEqual([
      ["doc-1", "latest one"],
      ["doc-2", "latest two"]
    ]);
  });
});
