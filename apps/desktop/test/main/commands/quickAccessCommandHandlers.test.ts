import { describe, expect, it, vi } from "vitest";
import {
  handleQuickAccessRequest,
  getWindowCommandContext
} from "../../../src/main/commands/quickAccessCommandHandlers";
import { initialDesktopShellSnapshot } from "../../../src/shared/shellState";

describe("quick access process boundary", () => {
  it("rejects a stale workspace generation and a removed file", async () => {
    const openFile = vi.fn();
    const ports = {
      getSnapshot: () => ({
        ...initialDesktopShellSnapshot,
        workspaceIndex: {
          generation: 3,
          revision: 1,
          status: "ready" as const,
          error: null
        },
        workspaceEntries: [
          { kind: "file" as const, path: "/a.md", name: "a.md", depth: 0 }
        ]
      }),
      openFile,
      activate: vi.fn(),
      refresh: vi.fn(),
      setOpen: vi.fn()
    };
    expect(
      (
        await handleQuickAccessRequest(
          { kind: "workspace-file", path: "/a.md", workspaceGeneration: 1 },
          ports
        )
      ).status
    ).toBe("unavailable");
    expect(
      (
        await handleQuickAccessRequest(
          { kind: "workspace-file", path: "/gone.md", workspaceGeneration: 3 },
          ports
        )
      ).status
    ).toBe("unavailable");
    expect(openFile).not.toHaveBeenCalled();
  });
  it("preserves opening failures and cancellation results", async () => {
    const result = { status: "failed" as const, message: "Missing file" };
    const ports = {
      getSnapshot: () => ({
        ...initialDesktopShellSnapshot,
        workspaceEntries: [
          { kind: "file" as const, path: "/a.md", name: "a.md", depth: 0 }
        ]
      }),
      openFile: vi.fn(async () => result),
      activate: vi.fn(),
      refresh: vi.fn(),
      setOpen: vi.fn()
    };
    expect(
      await handleQuickAccessRequest(
        { kind: "workspace-file", path: "/a.md", workspaceGeneration: 0 },
        ports
      )
    ).toBe(result);
  });
  it("allows Settings close without exposing document operations", () => {
    expect(
      getWindowCommandContext({
        ...initialDesktopShellSnapshot,
        activeTabId: "settings"
      })
    ).toMatchObject({
      canCloseActiveTab: true,
      hasActiveDocument: false,
      canEditDocument: false,
      canReloadDocument: false
    });
  });
});
