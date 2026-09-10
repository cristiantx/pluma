import type { DesktopFileLocation, FileSystemAdapter } from "@pluma/core";

import type {
  WorkspaceSearchMatch,
  WorkspaceSearchOptions,
  WorkspaceTreeEntry
} from "../../shared/shellState";
import { WorkspaceWatcher } from "../watching/workspaceWatcher";
import { collectWorkspaceEntries } from "./desktopWorkspace";
import { WorkspaceSearchController } from "./workspaceSearch";

export type WorkspaceScanState = {
  status: "loading" | "ready" | "error";
  error: string | null;
};

export type WindowWorkspaceCoordinatorDependencies = {
  emitStatus: (message: string) => void;
  fileSystem: FileSystemAdapter<DesktopFileLocation>;
  getRespectGitIgnore: () => boolean;
  getShowHiddenFiles: () => boolean;
  getWorkspacePath: () => string | null;
  publishEntries: (entries: WorkspaceTreeEntry[]) => void;
  publishScanState?: (state: WorkspaceScanState) => void;
};

export class WindowWorkspaceCoordinator {
  private refreshPromise: Promise<void> | null = null;
  private refreshVersion = 0;
  private disposed = false;
  private readonly searchController = new WorkspaceSearchController();
  private readonly watcher: WorkspaceWatcher;

  constructor(
    private readonly dependencies: WindowWorkspaceCoordinatorDependencies
  ) {
    this.watcher = new WorkspaceWatcher(() => {
      void this.refresh();
    }, dependencies.emitStatus);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.refreshVersion += 1;
    this.watcher.close();
    this.searchController.dispose();
  }

  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.refreshVersion += 1;

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refresh = async () => {
      let completedVersion = 0;

      while (!this.disposed && completedVersion !== this.refreshVersion) {
        const refreshVersion = this.refreshVersion;
        const workspacePath = this.dependencies.getWorkspacePath();
        completedVersion = refreshVersion;

        if (!workspacePath) {
          continue;
        }

        this.dependencies.publishScanState?.({
          status: "loading",
          error: null
        });
        let workspaceEntries: WorkspaceTreeEntry[];
        try {
          workspaceEntries = await collectWorkspaceEntries(
            this.dependencies.fileSystem,
            workspacePath,
            0,
            {
              respectGitIgnore: this.dependencies.getRespectGitIgnore(),
              showHiddenFiles: this.dependencies.getShowHiddenFiles()
            }
          );
        } catch (error) {
          if (
            !this.disposed &&
            refreshVersion === this.refreshVersion &&
            workspacePath === this.dependencies.getWorkspacePath()
          ) {
            this.dependencies.publishScanState?.({
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to scan workspace."
            });
          }
          continue;
        }

        if (
          this.disposed ||
          refreshVersion !== this.refreshVersion ||
          workspacePath !== this.dependencies.getWorkspacePath()
        ) {
          continue;
        }

        this.dependencies.publishEntries(workspaceEntries);
        this.dependencies.publishScanState?.({ status: "ready", error: null });
      }
    };
    const refreshPromise = refresh().finally(() => {
      if (this.refreshPromise === refreshPromise) {
        this.refreshPromise = null;
      }
    });
    this.refreshPromise = refreshPromise;
    return refreshPromise;
  }

  async search(
    query: unknown,
    folderPath: unknown,
    options: unknown
  ): Promise<WorkspaceSearchMatch[]> {
    const workspacePath = this.dependencies.getWorkspacePath();

    if (
      this.disposed ||
      typeof query !== "string" ||
      !workspacePath ||
      !isWorkspaceSearchOptions(options)
    ) {
      return [];
    }

    return this.searchController.search({
      folderPath: typeof folderPath === "string" ? folderPath : null,
      options: {
        ...options,
        respectGitIgnore: this.dependencies.getRespectGitIgnore()
      },
      query,
      workspacePath
    });
  }

  updateWatcher(): void {
    if (!this.disposed)
      this.watcher.update(this.dependencies.getWorkspacePath());
  }
}

function isWorkspaceSearchOptions(
  options: unknown
): options is WorkspaceSearchOptions {
  return (
    typeof options === "object" &&
    options !== null &&
    typeof (options as { caseSensitive?: unknown }).caseSensitive ===
      "boolean" &&
    typeof (options as { regexp?: unknown }).regexp === "boolean" &&
    typeof (options as { wholeWord?: unknown }).wholeWord === "boolean"
  );
}
