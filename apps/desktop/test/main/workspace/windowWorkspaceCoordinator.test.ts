import type { DesktopFileLocation, FileSystemAdapter } from "@pluma/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceTreeEntry } from "../../../src/shared/shellState";

const mocks = vi.hoisted(() => ({
  collect: vi.fn(),
  searchDispose: vi.fn(),
  search: vi.fn(),
  watcherClose: vi.fn(),
  watcherUpdate: vi.fn()
}));

vi.mock("../../../src/main/workspace/desktopWorkspace", () => ({
  tryCollectWorkspaceEntries: mocks.collect
}));
vi.mock("../../../src/main/workspace/workspaceSearch", () => ({
  WorkspaceSearchController: class {
    dispose = mocks.searchDispose;
    search = mocks.search;
  }
}));
vi.mock("../../../src/main/watching/workspaceWatcher", () => ({
  WorkspaceWatcher: class {
    close = mocks.watcherClose;
    update = mocks.watcherUpdate;
  }
}));

import { WindowWorkspaceCoordinator } from "../../../src/main/workspace/windowWorkspaceCoordinator";

const fileSystem = {} as FileSystemAdapter<DesktopFileLocation>;
const firstEntries: WorkspaceTreeEntry[] = [
  { depth: 0, kind: "file", name: "first.md", path: "/first/first.md" }
];
const secondEntries: WorkspaceTreeEntry[] = [
  { depth: 0, kind: "file", name: "second.md", path: "/second/second.md" }
];

describe("WindowWorkspaceCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coalesces overlapping refresh requests and publishes the latest scan", async () => {
    const first = deferred<WorkspaceTreeEntry[]>();
    const publishEntries = vi.fn();
    mocks.collect
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(secondEntries);
    const coordinator = createCoordinator(() => "/workspace", publishEntries);

    const initialRefresh = coordinator.refresh();
    const coalescedRefresh = coordinator.refresh();

    expect(coalescedRefresh).toBe(initialRefresh);
    first.resolve(firstEntries);
    await initialRefresh;

    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(publishEntries).toHaveBeenCalledTimes(1);
    expect(publishEntries).toHaveBeenCalledWith(secondEntries);
  });

  it("discards results when the workspace path changes during a scan", async () => {
    const first = deferred<WorkspaceTreeEntry[]>();
    const publishEntries = vi.fn();
    let workspacePath = "/first";
    mocks.collect
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(secondEntries);
    const coordinator = createCoordinator(() => workspacePath, publishEntries);

    const refresh = coordinator.refresh();
    workspacePath = "/second";
    void coordinator.refresh();
    first.resolve(firstEntries);
    await refresh;

    expect(mocks.collect.mock.calls.map((call) => call[1])).toEqual([
      "/first",
      "/second"
    ]);
    expect(publishEntries).toHaveBeenCalledTimes(1);
    expect(publishEntries).toHaveBeenCalledWith(secondEntries);
  });
});

function createCoordinator(
  getWorkspacePath: () => string | null,
  publishEntries: (entries: WorkspaceTreeEntry[]) => void
): WindowWorkspaceCoordinator {
  return new WindowWorkspaceCoordinator({
    emitStatus: vi.fn(),
    fileSystem,
    getRespectGitIgnore: () => true,
    getShowHiddenFiles: () => false,
    getWorkspacePath,
    publishEntries
  });
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
