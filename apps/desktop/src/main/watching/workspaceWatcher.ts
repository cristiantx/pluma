import { watch, type FSWatcher } from "node:fs";

export class WorkspaceWatcher {
  private refreshTimer: NodeJS.Timeout | null = null;
  private watcher: FSWatcher | null = null;

  constructor(
    private readonly onChange: () => void,
    private readonly onError: (message: string) => void
  ) {}

  close(): void {
    this.watcher?.close();
    this.watcher = null;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  update(workspacePath: string | null): void {
    this.close();

    if (!workspacePath) {
      return;
    }

    try {
      this.watcher = watch(
        workspacePath,
        // MVP targets macOS, where recursive fs.watch is supported.
        { persistent: false, recursive: true },
        () => {
          this.scheduleRefresh();
        }
      );
    } catch (error) {
      this.onError(
        error instanceof Error
          ? `Could not watch workspace: ${error.message}`
          : "Could not watch workspace."
      );
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.onChange();
    }, 250);
  }
}
