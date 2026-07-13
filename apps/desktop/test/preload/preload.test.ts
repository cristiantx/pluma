import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>();

  return {
    exposeInMainWorld: vi.fn(),
    invoke: vi.fn(() => Promise.resolve()),
    listeners,
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listeners.set(channel, listener);
    }),
    removeListener: vi.fn(),
    send: vi.fn()
  };
});

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: electron.exposeInMainWorld
  },
  ipcRenderer: {
    invoke: electron.invoke,
    on: electron.on,
    removeListener: electron.removeListener,
    send: electron.send
  }
}));

await import("../../src/preload");

type PreloadApi = {
  closeTab(tabId: string): Promise<unknown>;
  runCommand(command: "save"): Promise<unknown>;
  setActiveTab(tabId: string): Promise<unknown>;
  updateDocumentText(documentId: string, rawText: string): void;
};

const api = electron.exposeInMainWorld.mock.calls[0]?.[1] as PreloadApi;

describe("desktop preload document synchronization", () => {
  beforeEach(() => {
    electron.invoke.mockClear();
    electron.send.mockClear();
  });

  it.each([
    ["save", () => api.runCommand("save")],
    ["close", () => api.closeTab("doc-1")],
    ["switch", () => api.setActiveTab("doc-2")]
  ])(
    "flushes the latest text before an immediate %s action",
    async (_, act) => {
      api.updateDocumentText("doc-1", "first");
      api.updateDocumentText("doc-1", "latest");

      await act();

      expect(electron.send).toHaveBeenCalledWith(
        "pluma:update-document-text",
        "doc-1",
        "latest"
      );
      expect(electron.send.mock.invocationCallOrder[0]).toBeLessThan(
        electron.invoke.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
      );
    }
  );

  it("flushes before acknowledging a native lifecycle request", () => {
    api.updateDocumentText("doc-1", "latest");
    const listener = electron.listeners.get(
      "pluma:flush-pending-document-text"
    );

    listener?.({}, "request-1");

    expect(electron.send.mock.calls).toEqual([
      ["pluma:update-document-text", "doc-1", "latest"],
      ["pluma:document-text-flushed", "request-1"]
    ]);
  });
});
