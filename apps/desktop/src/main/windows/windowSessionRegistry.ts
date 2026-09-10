export type WindowSession = {
  window: {
    id: number;
    isDestroyed: () => boolean;
  };
  getAuthorizedAssetRoots: () => string[];
};

export type WindowSessionRegistryNativePorts = {
  getFocusedWindowId: () => number | null;
  getSenderWindowId: (sender: unknown) => number | null;
};

export class WindowSessionRegistry<T extends WindowSession> {
  private readonly sessions = new Map<number, T>();
  private latestFocusedWindowId: number | null = null;

  constructor(private readonly native: WindowSessionRegistryNativePorts) {}

  get(windowId: number): T | null {
    return this.sessions.get(windowId) ?? null;
  }

  add(session: T): void {
    this.sessions.set(session.window.id, session);
    this.latestFocusedWindowId = session.window.id;
  }

  remove(windowId: number): void {
    this.sessions.delete(windowId);

    if (this.latestFocusedWindowId === windowId) {
      this.latestFocusedWindowId = this.ordered().at(-1)?.window.id ?? null;
    }
  }

  markFocused(windowId: number): void {
    this.latestFocusedWindowId = windowId;
  }

  ordered(): T[] {
    return [...this.sessions.values()].filter(
      (session) => !session.window.isDestroyed()
    );
  }

  latest(): T | null {
    if (this.latestFocusedWindowId !== null) {
      const latestSession = this.sessions.get(this.latestFocusedWindowId);

      if (latestSession && !latestSession.window.isDestroyed()) {
        return latestSession;
      }
    }

    const focusedWindowId = this.native.getFocusedWindowId();
    if (focusedWindowId !== null) {
      return this.sessions.get(focusedWindowId) ?? null;
    }

    return this.ordered().at(-1) ?? null;
  }

  forSender(sender: unknown): T | null {
    const senderWindowId = this.native.getSenderWindowId(sender);

    return senderWindowId === null
      ? null
      : (this.sessions.get(senderWindowId) ?? null);
  }

  authorizedAssetRoots(): string[] {
    return [
      ...new Set(
        this.ordered().flatMap((session) => session.getAuthorizedAssetRoots())
      )
    ];
  }

  clear(): void {
    this.sessions.clear();
    this.latestFocusedWindowId = null;
  }

  values(): IterableIterator<T> {
    return this.sessions.values();
  }
}
