export class AutosaveScheduler {
  private readonly delayMs: number;
  private readonly save: (documentId: string) => void;
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(delayMs: number, save: (documentId: string) => void) {
    this.delayMs = delayMs;
    this.save = save;
  }

  clear(documentId: string): void {
    const timer = this.timers.get(documentId);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(documentId);
  }

  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }

  schedule(documentId: string): void {
    this.clear(documentId);

    this.timers.set(
      documentId,
      setTimeout(() => {
        this.timers.delete(documentId);
        this.save(documentId);
      }, this.delayMs)
    );
  }
}
