import type { WebContents } from "electron";

type FlushTarget = Pick<
  WebContents,
  "id" | "isDestroyed" | "isLoading" | "send"
>;

type PendingFlush = {
  resolve: (flushed: boolean) => void;
  senderId: number;
  timer: ReturnType<typeof setTimeout>;
};

export const documentTextFlushTimeoutMs = 2_000;

export class DocumentTextFlushCoordinator {
  private nextRequestId = 0;
  private readonly pendingFlushes = new Map<string, PendingFlush>();

  constructor(private readonly timeoutMs = documentTextFlushTimeoutMs) {}

  request(target: FlushTarget): Promise<boolean> {
    if (target.isDestroyed() || target.isLoading()) {
      return Promise.resolve(true);
    }

    const requestId = `${target.id}:${++this.nextRequestId}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.finish(requestId, false);
      }, this.timeoutMs);
      this.pendingFlushes.set(requestId, {
        resolve,
        senderId: target.id,
        timer
      });

      try {
        target.send("pluma:flush-pending-document-text", requestId);
      } catch {
        this.finish(requestId, false);
      }
    });
  }

  acknowledge(senderId: number, requestId: unknown): void {
    if (typeof requestId !== "string") {
      return;
    }

    const pending = this.pendingFlushes.get(requestId);

    if (!pending || pending.senderId !== senderId) {
      return;
    }

    this.finish(requestId, true);
  }

  cancelSender(senderId: number): void {
    for (const [requestId, pending] of this.pendingFlushes) {
      if (pending.senderId === senderId) {
        this.finish(requestId, false);
      }
    }
  }

  private finish(requestId: string, flushed: boolean): void {
    const pending = this.pendingFlushes.get(requestId);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pendingFlushes.delete(requestId);
    pending.resolve(flushed);
  }
}
