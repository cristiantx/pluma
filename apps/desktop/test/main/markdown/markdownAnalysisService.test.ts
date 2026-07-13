import { describe, expect, it, vi } from "vitest";

import { MarkdownAnalysisService } from "../../../src/main/markdown/markdownAnalysisService";

type WorkerEvent = "error" | "exit" | "message";

function createWorker() {
  const listeners = new Map<WorkerEvent, (...args: never[]) => void>();
  const worker = {
    emit(event: WorkerEvent, value: unknown) {
      listeners.get(event)?.(value as never);
    },
    on: vi.fn((event: WorkerEvent, listener: (...args: never[]) => void) => {
      listeners.set(event, listener);
      return worker;
    }),
    postMessage: vi.fn(),
    terminate: vi.fn(() => Promise.resolve(0))
  };

  return worker;
}

describe("MarkdownAnalysisService", () => {
  it("bypasses the worker when HTML is impossible", async () => {
    const createWorker = vi.fn();
    const service = new MarkdownAnalysisService({
      createWorker,
      onError: vi.fn(),
      workerPath: "/worker.js"
    });

    await expect(service.analyze("# Ordinary Markdown\n")).resolves.toBe(
      "none"
    );
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("returns the worker analysis for possible HTML", async () => {
    const worker = createWorker();
    const service = new MarkdownAnalysisService({
      createWorker: () => worker as never,
      onError: vi.fn(),
      workerPath: "/worker.js"
    });
    const result = service.analyze("<aside>Note</aside>");
    const request = worker.postMessage.mock.calls[0]?.[0];

    worker.emit("message", {
      modeConstraint: "source-only",
      requestId: request.requestId
    });

    await expect(result).resolves.toBe("source-only");
  });

  it("fails safely to source-only and reports worker errors", async () => {
    const worker = createWorker();
    const onError = vi.fn();
    const service = new MarkdownAnalysisService({
      createWorker: () => worker as never,
      onError,
      workerPath: "/worker.js"
    });
    const result = service.analyze("<broken");

    worker.emit("error", new Error("worker unavailable"));

    await expect(result).resolves.toBe("source-only");
    expect(onError).toHaveBeenCalledWith(
      "Markdown analysis failed: worker unavailable"
    );
  });
});
