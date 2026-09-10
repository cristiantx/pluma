import { describe, expect, it, vi } from "vitest";

import { WindowSessionRegistry } from "../../../src/main/windows/windowSessionRegistry";

function createSession(id: number, roots: string[] = [], destroyed = false) {
  return {
    window: {
      id,
      isDestroyed: vi.fn(() => destroyed)
    },
    getAuthorizedAssetRoots: vi.fn(() => roots)
  };
}

function createRegistry() {
  let focusedWindowId: number | null = null;
  const senderWindows = new Map<unknown, number>();
  const registry = new WindowSessionRegistry({
    getFocusedWindowId: () => focusedWindowId,
    getSenderWindowId: (sender) => senderWindows.get(sender) ?? null
  });

  return {
    registry,
    senderWindows,
    setFocusedWindowId: (windowId: number | null) => {
      focusedWindowId = windowId;
    }
  };
}

describe("WindowSessionRegistry", () => {
  it("prefers the latest tracked session before native focus and insertion order", () => {
    const { registry, setFocusedWindowId } = createRegistry();
    const first = createSession(1);
    const second = createSession(2);

    registry.add(first);
    registry.add(second);
    setFocusedWindowId(1);

    expect(registry.latest()).toBe(second);

    registry.markFocused(1);
    expect(registry.latest()).toBe(first);

    registry.markFocused(99);
    expect(registry.latest()).toBe(first);

    setFocusedWindowId(null);
    expect(registry.latest()).toBe(second);
  });

  it("isolates sender lookup through the native sender mapping", () => {
    const { registry, senderWindows } = createRegistry();
    const firstSender = {};
    const secondSender = {};
    const first = createSession(1);
    const second = createSession(2);
    registry.add(first);
    registry.add(second);
    senderWindows.set(firstSender, 1);
    senderWindows.set(secondSender, 2);

    expect(registry.forSender(firstSender)).toBe(first);
    expect(registry.forSender(secondSender)).toBe(second);
    expect(registry.forSender({})).toBeNull();
  });

  it("removes sessions and moves latest focus to the last live session", () => {
    const { registry } = createRegistry();
    const first = createSession(1);
    const destroyed = createSession(2, [], true);
    const third = createSession(3);
    registry.add(first);
    registry.add(destroyed);
    registry.add(third);

    registry.remove(3);

    expect(registry.get(3)).toBeNull();
    expect(registry.latest()).toBe(first);
    expect([...registry.values()]).toEqual([first, destroyed]);
  });

  it("filters destroyed sessions and deduplicates authorized roots in order", () => {
    const { registry } = createRegistry();
    const first = createSession(1, ["/workspace", "/shared"]);
    const destroyed = createSession(2, ["/private"], true);
    const third = createSession(3, ["/shared", "/documents"]);
    registry.add(first);
    registry.add(destroyed);
    registry.add(third);

    expect(registry.ordered()).toEqual([first, third]);
    expect(registry.authorizedAssetRoots()).toEqual([
      "/workspace",
      "/shared",
      "/documents"
    ]);
    expect(destroyed.getAuthorizedAssetRoots).not.toHaveBeenCalled();
  });

  it("clears sessions and tracked focus", () => {
    const { registry } = createRegistry();
    registry.add(createSession(1));

    registry.clear();

    expect([...registry.values()]).toEqual([]);
    expect(registry.latest()).toBeNull();
  });
});
