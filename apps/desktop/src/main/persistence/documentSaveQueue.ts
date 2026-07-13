export class DocumentSaveQueue {
  private readonly queues = new Map<string, Promise<boolean>>();

  enqueue(
    documentId: string,
    operation: () => Promise<boolean>
  ): Promise<boolean> {
    const previousSave = this.queues.get(documentId);
    const nextSave = (previousSave ?? Promise.resolve(true))
      .catch(() => false)
      .then(operation);

    this.queues.set(documentId, nextSave);
    const clearCompletedSave = (): void => {
      if (this.queues.get(documentId) === nextSave) {
        this.queues.delete(documentId);
      }
    };
    void nextSave.then(clearCompletedSave, clearCompletedSave);

    return nextSave;
  }

  waitFor(documentId: string): Promise<boolean> {
    return this.queues.get(documentId) ?? Promise.resolve(true);
  }
}
