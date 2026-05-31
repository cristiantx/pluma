import { watch, type FSWatcher } from "node:fs";
import path from "node:path";

export class ActiveFileWatcher {
  private watchedDirectoryPath: string | null = null;
  private watchedFileName: string | null = null;
  private watcher: FSWatcher | null = null;

  constructor(
    private readonly onChange: (filePath: string) => void,
    private readonly onError: (message: string) => void
  ) {}

  close(): void {
    this.watcher?.close();
    this.watcher = null;
    this.watchedDirectoryPath = null;
    this.watchedFileName = null;
  }

  update(filePath: string | null): void {
    const directoryPath = filePath ? path.dirname(filePath) : null;
    const fileName = filePath ? path.basename(filePath) : null;

    if (
      this.watchedDirectoryPath === directoryPath &&
      this.watchedFileName === fileName
    ) {
      return;
    }

    this.close();

    if (!directoryPath || !fileName || !filePath) {
      return;
    }

    this.watchedDirectoryPath = directoryPath;
    this.watchedFileName = fileName;

    try {
      this.watcher = watch(
        directoryPath,
        { persistent: false },
        (_eventType, changedFileName) => {
          if (!isWatchedFileName(changedFileName, this.watchedFileName)) {
            return;
          }

          this.onChange(filePath);
        }
      );
    } catch (error) {
      this.watchedDirectoryPath = null;
      this.watchedFileName = null;
      this.onError(
        error instanceof Error
          ? `Could not watch active file: ${error.message}`
          : "Could not watch active file."
      );
    }
  }
}

export function isWatchedFileName(
  changedFileName: string | Buffer | null,
  watchedFileName: string | null
): boolean {
  if (!changedFileName || !watchedFileName) {
    return true;
  }

  return changedFileName.toString() === watchedFileName;
}
