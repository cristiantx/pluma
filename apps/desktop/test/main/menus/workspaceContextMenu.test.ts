import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => template
  }
}));

import {
  buildWorkspaceContextMenu,
  executeWorkspaceMenuCommand,
  type WorkspaceContextMenuOptions
} from "../../../src/main/menus/workspaceContextMenu";

function createOptions(
  overrides: Partial<WorkspaceContextMenuOptions> = {}
): WorkspaceContextMenuOptions {
  return {
    target: { path: "/notes", kind: "folder" },
    canFindInFolder: true,
    canPaste: true,
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onFindInFolder: vi.fn(),
    onMoveToTrash: vi.fn(),
    onNewDirectory: vi.fn(),
    onNewFile: vi.fn(),
    onPaste: vi.fn(),
    onRename: vi.fn(),
    onShowInFolder: vi.fn(),
    ...overrides
  };
}

function buildMenuTemplate(options = createOptions()) {
  return buildWorkspaceContextMenu(
    options
  ) as unknown as MenuItemConstructorOptions[];
}

function findItem(template: MenuItemConstructorOptions[], label: string) {
  const item = template.find((candidate) => candidate.label === label);
  if (!item) throw new Error(`Missing menu item: ${label}`);
  return item;
}

describe("buildWorkspaceContextMenu", () => {
  it("preserves the registry labels and native menu grouping", () => {
    expect(buildMenuTemplate().map((item) => item.label)).toEqual([
      "New File",
      "New Directory",
      undefined,
      "Copy",
      "Cut",
      "Paste",
      undefined,
      "Rename",
      "Move To Trash",
      undefined,
      "Find In Folder",
      "Show In Folder"
    ]);
  });

  it("derives disabled state from command availability", () => {
    const template = buildMenuTemplate(
      createOptions({ canFindInFolder: false, canPaste: false })
    );

    expect(findItem(template, "Paste").enabled).toBe(false);
    expect(findItem(template, "Find In Folder").enabled).toBe(false);
    expect(findItem(template, "Copy").enabled).toBe(true);
  });

  it("passes the typed target request to the command override", () => {
    const onCommand = vi.fn();
    const options = createOptions({ onCommand });
    const item = findItem(buildMenuTemplate(options), "New File");

    item.click?.({} as Electron.MenuItem, undefined, undefined);

    expect(onCommand).toHaveBeenCalledWith({
      id: "workspace-new-file",
      args: options.target
    });
    expect(options.onNewFile).not.toHaveBeenCalled();
  });

  it("routes through existing callbacks and quietly rejects stale unavailable commands", async () => {
    const options = createOptions();
    const request = { id: "workspace-paste", args: options.target } as const;

    await executeWorkspaceMenuCommand(request, options);
    expect(options.onPaste).toHaveBeenCalledOnce();

    options.canPaste = false;
    await executeWorkspaceMenuCommand(request, options);
    expect(options.onPaste).toHaveBeenCalledOnce();
  });
});
