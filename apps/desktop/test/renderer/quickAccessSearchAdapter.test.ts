import { describe, expect, it, vi } from "vitest";
import type { FileCandidate } from "@pluma/core";
import {
  createQuickAccessSearchAdapter,
  type QuickAccessWorker,
  type QuickAccessWorkerResponse
} from "../../src/renderer/quickaccess/quickAccessSearchAdapter";

function fixture() {
  const worker: QuickAccessWorker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null
  };
  const adapter = createQuickAccessSearchAdapter(() => worker);
  const respond = (message: QuickAccessWorkerResponse) =>
    worker.onmessage?.call(worker as Worker, { data: message } as MessageEvent);
  return { worker, adapter, respond };
}
const candidates: FileCandidate[] = [
  {
    id: "one",
    name: "one.md",
    path: "/one.md",
    relativePath: "one.md",
    documentId: null,
    recency: null
  }
];
const response = { results: [], total: 0 };

describe("quick access worker adapter", () => {
  it("sends candidate data only when array identity changes", async () => {
    const { adapter, worker, respond } = fixture();
    const first = adapter.search(candidates, "one");
    respond({ type: "results", revision: 1, requestId: 1, response });
    await first;
    const second = adapter.search(candidates, "two");
    respond({ type: "results", revision: 1, requestId: 2, response });
    await second;
    const third = adapter.search([...candidates], "three");
    respond({ type: "results", revision: 2, requestId: 3, response });
    await third;
    expect(
      vi.mocked(worker.postMessage).mock.calls.map(([message]) => message.type)
    ).toEqual(["index", "query", "query", "index", "query"]);
    adapter.dispose();
  });

  it("aborts superseded searches and ignores old request and revision responses", async () => {
    const { adapter, respond } = fixture();
    const first = adapter.search(candidates, "one");
    const rejection = expect(first).rejects.toMatchObject({
      name: "AbortError"
    });
    const second = adapter.search([...candidates], "two");
    await rejection;
    let settled = false;
    void second.then(() => {
      settled = true;
    });
    respond({ type: "results", revision: 1, requestId: 1, response });
    respond({ type: "results", revision: 1, requestId: 2, response });
    await Promise.resolve();
    expect(settled).toBe(false);
    respond({ type: "results", revision: 2, requestId: 2, response });
    await expect(second).resolves.toEqual(response);
    adapter.dispose();
  });

  it("rejects pending and future searches after a worker failure", async () => {
    const { adapter, worker } = fixture();
    const pending = adapter.search(candidates, "one");
    worker.onerror?.call(worker as Worker, {} as ErrorEvent);
    await expect(pending).rejects.toThrow("worker failed");
    await expect(adapter.search(candidates, "two")).rejects.toThrow(
      "worker failed"
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("reports search errors without poisoning later queries", async () => {
    const { adapter, respond } = fixture();
    const first = adapter.search(candidates, "one");
    respond({ type: "error", revision: 1, requestId: 1, message: "Bad query" });
    await expect(first).rejects.toThrow("Bad query");
    const second = adapter.search(candidates, "two");
    respond({ type: "results", revision: 1, requestId: 2, response });
    await expect(second).resolves.toEqual(response);
    adapter.dispose();
  });

  it("terminates and detaches listeners on disposal and rejects outstanding work", async () => {
    const { adapter, worker } = fixture();
    const pending = adapter.search(candidates, "one");
    adapter.dispose();
    adapter.dispose();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(adapter.search(candidates, "two")).rejects.toMatchObject({
      name: "AbortError"
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });
});

describe("quick access worker cooperative scheduling", () => {
  it("finishes only the latest query while the shared index is being built", async () => {
    vi.useFakeTimers();
    const scope = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage: vi.fn()
    };
    vi.stubGlobal("self", scope);
    try {
      vi.resetModules();
      await import("../../src/renderer/quickaccess/quickAccessSearchWorker");
      const many = Array.from({ length: 301 }, (_, index) => ({
        ...candidates[0]!,
        id: String(index),
        name: `note-${index}.md`,
        path: `/note-${index}.md`,
        relativePath: `note-${index}.md`
      }));
      scope.onmessage?.({
        data: { type: "index", revision: 1, candidates: many }
      });
      scope.onmessage?.({
        data: { type: "query", revision: 1, requestId: 1, query: "missing" }
      });
      scope.onmessage?.({
        data: { type: "query", revision: 1, requestId: 2, query: "note" }
      });
      await vi.runAllTimersAsync();
      expect(scope.postMessage).toHaveBeenCalledOnce();
      expect(scope.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "results",
          revision: 1,
          requestId: 2,
          response: expect.objectContaining({ total: 301 })
        })
      );
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("drops a partially built index when a newer revision arrives", async () => {
    vi.useFakeTimers();
    const scope = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage: vi.fn()
    };
    vi.stubGlobal("self", scope);
    try {
      vi.resetModules();
      await import("../../src/renderer/quickaccess/quickAccessSearchWorker");
      scope.onmessage?.({ data: { type: "index", revision: 1, candidates } });
      scope.onmessage?.({
        data: { type: "query", revision: 1, requestId: 1, query: "one" }
      });
      scope.onmessage?.({
        data: { type: "index", revision: 2, candidates: [] }
      });
      scope.onmessage?.({
        data: { type: "query", revision: 2, requestId: 2, query: "one" }
      });
      await vi.runAllTimersAsync();
      expect(scope.postMessage).toHaveBeenCalledExactlyOnceWith({
        type: "results",
        revision: 2,
        requestId: 2,
        response
      });
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
