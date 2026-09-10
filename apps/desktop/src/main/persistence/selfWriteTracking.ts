/** One window-scoped set shared by document saves and workspace file actions. */
export class SelfWriteTracking {
  readonly paths = new Set<string>();
  mark(path: string): void {
    this.paths.add(path);
  }
  unmark(path: string): void {
    this.paths.delete(path);
  }
  has(path: string): boolean {
    return this.paths.has(path);
  }
}
