export const documentTextSyncDelayMs = 75;

export type SendDocumentText = (documentId: string, rawText: string) => void;

export class PendingDocumentTextSync {
  private readonly pendingText = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly sendDocumentText: SendDocumentText,
    private readonly delayMs = documentTextSyncDelayMs
  ) {}

  schedule(documentId: string, rawText: string): void {
    this.pendingText.set(documentId, rawText);

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.delayMs);
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    for (const [documentId, rawText] of this.pendingText) {
      this.sendDocumentText(documentId, rawText);
    }

    this.pendingText.clear();
  }
}
