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
  collectWorkspaceEntries: mocks.collect
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

import {
  WindowWorkspaceCoordinator,
  type WorkspaceScanState
} from "../../../src/main/workspace/windowWorkspaceCoordinator";

const fileSystem = {} as FileSystemAdapter<DesktopFileLocation>;
const firstEntries: WorkspaceTreeEntry[] = [
  { depth: 0, kind: "file", name: "first.md", path: "/first/first.md" }
];
const secondEntries: WorkspaceTreeEntry[] = [
  { depth: 0, kind: "file", name: "second.md", path: "/second/second.md" }
];

describe("WindowWorkspaceCoordinator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
  it("retains accepted entries on failure and distinguishes an empty successful scan", async () => {
    const publishEntries = vi.fn();
    const publishScanState = vi.fn();
    const coordinator = createCoordinator(
      () => "/workspace",
      publishEntries,
      publishScanState
    );
    mocks.collect
      .mockResolvedValueOnce(firstEntries)
      .mockRejectedValueOnce(new Error("Access denied"))
      .mockResolvedValueOnce([]);
    await coordinator.refresh();
    await coordinator.refresh();
    expect(publishEntries.mock.calls).toEqual([[firstEntries]]);
    expect(publishScanState).toHaveBeenLastCalledWith({
      status: "error",
      error: "Access denied"
    });
    await coordinator.refresh();
    expect(publishEntries.mock.calls).toEqual([[firstEntries], [[]]]);
    expect(publishScanState.mock.calls.map(([state]) => state.status)).toEqual([
      "loading",
      "ready",
      "loading",
      "error",
      "loading",
      "ready"
    ]);
  });

  it("does not publish or restart after disposal during a scan", async () => {
    const first = deferred<WorkspaceTreeEntry[]>();
    const publishEntries = vi.fn();
    const publishScanState = vi.fn();
    mocks.collect.mockReturnValueOnce(first.promise);
    const coordinator = createCoordinator(
      () => "/workspace",
      publishEntries,
      publishScanState
    );
    const pending = coordinator.refresh();
    coordinator.dispose();
    first.resolve(firstEntries);
    await pending;
    await coordinator.refresh();
    coordinator.updateWatcher();
    expect(publishEntries).not.toHaveBeenCalled();
    expect(publishScanState.mock.calls).toEqual([
      [{ status: "loading", error: null }]
    ]);
    expect(mocks.collect).toHaveBeenCalledTimes(1);
    expect(mocks.watcherUpdate).not.toHaveBeenCalled();
  });

  it("suppresses an obsolete failure and scans the latest requested workspace", async () => {
    let reject!: (error: Error) => void;
    const first = new Promise<WorkspaceTreeEntry[]>((_, rejectPromise) => {
      reject = rejectPromise;
    });
    const publishEntries = vi.fn();
    const publishScanState = vi.fn();
    let workspacePath = "/first";
    mocks.collect
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(secondEntries);
    const coordinator = createCoordinator(
      () => workspacePath,
      publishEntries,
      publishScanState
    );
    const pending = coordinator.refresh();
    workspacePath = "/second";
    void coordinator.refresh();
    reject(new Error("Stale failure"));
    await pending;
    expect(publishEntries).toHaveBeenCalledExactlyOnceWith(secondEntries);
    expect(publishScanState.mock.calls.map(([state]) => state.status)).toEqual([
      "loading",
      "loading",
      "ready"
    ]);
    expect(mocks.collect).toHaveBeenLastCalledWith(fileSystem, "/second", 0, {
      respectGitIgnore: true,
      showHiddenFiles: false
    });
  });
});

function createCoordinator(
  getWorkspacePath: () => string | null,
  publishEntries: (entries: WorkspaceTreeEntry[]) => void,
  publishScanState: (state: WorkspaceScanState) => void = vi.fn()
): WindowWorkspaceCoordinator {
  return new WindowWorkspaceCoordinator({
    emitStatus: vi.fn(),
    fileSystem,
    getRespectGitIgnore: () => true,
    getShowHiddenFiles: () => false,
    getWorkspacePath,
    publishEntries,
    publishScanState
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
