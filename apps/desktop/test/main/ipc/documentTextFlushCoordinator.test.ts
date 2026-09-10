import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentTextFlushCoordinator } from "../../../src/main/ipc/documentTextFlushCoordinator";

function createTarget(id = 1) {
  return {
    id,
    isDestroyed: vi.fn(() => false),
    isLoading: vi.fn(() => false),
    send: vi.fn()
  };
}

describe("DocumentTextFlushCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves only after the matching renderer acknowledges", async () => {
    const coordinator = new DocumentTextFlushCoordinator();
    const target = createTarget();
    const result = coordinator.request(target as never);
    const requestId = target.send.mock.calls[0]?.[1];
    const settled = vi.fn();

    void result.then(settled);

    coordinator.acknowledge(2, requestId);
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();

    coordinator.acknowledge(1, requestId);

    await expect(result).resolves.toBe(true);
    expect(target.send).toHaveBeenCalledWith(
      "pluma:flush-pending-document-text",
      requestId
    );
  });

  it("fails closed when sending the flush request throws", async () => {
    const coordinator = new DocumentTextFlushCoordinator();
    const target = createTarget();
    target.send.mockImplementation(() => {
      throw new Error("renderer unavailable");
    });

    await expect(coordinator.request(target as never)).resolves.toBe(false);
  });

  it("cancels only pending flushes for the requested sender", async () => {
    const coordinator = new DocumentTextFlushCoordinator();
    const firstTarget = createTarget(1);
    const secondTarget = createTarget(2);
    const firstResult = coordinator.request(firstTarget as never);
    const secondResult = coordinator.request(secondTarget as never);
    const secondRequestId = secondTarget.send.mock.calls[0]?.[1];
    const secondSettled = vi.fn();

    void secondResult.then(secondSettled);
    coordinator.cancelSender(1);

    await expect(firstResult).resolves.toBe(false);
    await Promise.resolve();
    expect(secondSettled).not.toHaveBeenCalled();

    coordinator.acknowledge(2, secondRequestId);
    await expect(secondResult).resolves.toBe(true);
  });

  it("fails closed after the timeout", async () => {
    vi.useFakeTimers();
    const coordinator = new DocumentTextFlushCoordinator(25);
    const result = coordinator.request(createTarget() as never);

    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBe(false);
  });

  it("does not wait for a renderer that cannot contain edits", async () => {
    const coordinator = new DocumentTextFlushCoordinator();
    const loadingTarget = createTarget();
    loadingTarget.isLoading.mockReturnValue(true);

    await expect(coordinator.request(loadingTarget as never)).resolves.toBe(
      true
    );
    expect(loadingTarget.send).not.toHaveBeenCalled();
  });
});
