export type QuitSession = {
  closeWindowWithProtection(): Promise<boolean>;
  window: { isDestroyed(): boolean };
};

export type DesktopQuitPorts<T extends QuitSession> = {
  getSessions(): T[];
  flush(session: T): Promise<boolean>;
  persist(): Promise<void>;
  quit(): void;
  reportFailure(message: string): void;
};

/** Coalesces quit attempts until protection and persistence have completed. */
export class DesktopQuitCoordinator<T extends QuitSession> {
  private pending: Promise<void> | null = null;
  private committed = false;

  constructor(private readonly ports: DesktopQuitPorts<T>) {}

  get isPending(): boolean {
    return this.pending !== null;
  }

  get isQuitting(): boolean {
    return this.committed;
  }

  request(): Promise<void> {
    if (this.committed) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.perform()
      .catch((error: unknown) => {
        this.committed = false;
        this.ports.reportFailure(
          error instanceof Error
            ? `Failed to save session before quitting: ${error.message}`
            : "Failed to save session before quitting."
        );
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  private async perform(): Promise<void> {
    const sessions = this.ports.getSessions();
    const results = await Promise.all(
      sessions.map((session) => this.ports.flush(session))
    );
    if (results.some((flushed) => !flushed)) return;
    for (const session of sessions) {
      if (
        !session.window.isDestroyed() &&
        !(await session.closeWindowWithProtection())
      )
        return;
    }
    await this.ports.persist();
    this.committed = true;
    this.ports.quit();
  }
}
