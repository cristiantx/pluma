import { afterEach, describe, expect, it, vi } from "vitest";

import { AutosaveScheduler } from "../../../src/main/autosave/autosaveScheduler";

afterEach(() => {
  vi.useRealTimers();
});

describe("AutosaveScheduler", () => {
  it("debounces saves per document", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const scheduler = new AutosaveScheduler(900, save);

    scheduler.schedule("a");
    vi.advanceTimersByTime(500);
    scheduler.schedule("a");
    vi.advanceTimersByTime(899);

    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(save).toHaveBeenCalledWith("a");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("clears scheduled saves", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const scheduler = new AutosaveScheduler(900, save);

    scheduler.schedule("a");
    scheduler.schedule("b");
    scheduler.clear("a");
    vi.advanceTimersByTime(900);

    expect(save).toHaveBeenCalledWith("b");
    expect(save).toHaveBeenCalledTimes(1);

    scheduler.schedule("c");
    scheduler.clearAll();
    vi.advanceTimersByTime(900);

    expect(save).toHaveBeenCalledTimes(1);
  });
});
