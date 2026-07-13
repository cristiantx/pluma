import { describe, expect, it, vi } from "vitest";

import { SessionStatePersistence } from "../../../src/main/session/sessionStatePersistence";

describe("SessionStatePersistence", () => {
  it("coalesces requests made while persistence is running", async () => {
    let releaseFirstRun: (() => void) | null = null;
    const persist = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstRun = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const coordinator = new SessionStatePersistence(persist);

    const firstRequest = coordinator.request();
    const secondRequest = coordinator.request();
    await vi.waitFor(() => expect(releaseFirstRun).not.toBeNull());
    releaseFirstRun?.();
    await Promise.all([firstRequest, secondRequest]);

    expect(persist).toHaveBeenCalledTimes(2);
  });
});
