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

    coordinator.acknowledge(2, requestId);
    coordinator.acknowledge(1, requestId);

    await expect(result).resolves.toBe(true);
    expect(target.send).toHaveBeenCalledWith(
      "pluma:flush-pending-document-text",
      requestId
    );
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
