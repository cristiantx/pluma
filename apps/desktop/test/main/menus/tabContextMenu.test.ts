import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => template
  }
}));

import {
  buildTabContextMenu,
  executeTabMenuCommand,
  type TabContextMenuOptions
} from "../../../src/main/menus/tabContextMenu";

function createOptions(
  overrides: Partial<TabContextMenuOptions> = {}
): TabContextMenuOptions {
  return {
    target: { tabId: "tab-1", tabIds: ["tab-1", "tab-2"] },
    canCloseAll: true,
    canCloseOthers: true,
    canCloseSavedTabs: true,
    canCopyPath: true,
    canRename: true,
    canRevealInWorkspace: true,
    canShowInFolder: true,
    onClose: vi.fn(),
    onCloseAll: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseSavedTabs: vi.fn(),
    onCopyPath: vi.fn(),
    onRename: vi.fn(),
    onRevealInWorkspace: vi.fn(),
    onShowInFolder: vi.fn(),
    ...overrides
  };
}

function buildMenuTemplate(options = createOptions()) {
  return buildTabContextMenu(
    options
  ) as unknown as MenuItemConstructorOptions[];
}

function findItem(template: MenuItemConstructorOptions[], label: string) {
  const item = template.find((candidate) => candidate.label === label);
  if (!item) throw new Error(`Missing menu item: ${label}`);
  return item;
}

describe("buildTabContextMenu", () => {
  it("preserves registry labels and the close-only Settings layout", () => {
    expect(
      buildMenuTemplate(createOptions({ includeFileActions: false })).map(
        (item) => item.label
      )
    ).toEqual(["Close", "Close others", "Close saved tabs", "Close all tabs"]);
  });

  it("includes registry-backed file actions for document tabs", () => {
    expect(buildMenuTemplate().map((item) => item.label)).toEqual([
      "Close",
      "Close others",
      "Close saved tabs",
      "Close all tabs",
      undefined,
      "Rename",
      "Copy path",
      "Show in folder",
      "Reveal in Workspace"
    ]);
  });

  it("derives disabled state from command availability", () => {
    const template = buildMenuTemplate(
      createOptions({ canCloseOthers: false, canCopyPath: false })
    );

    expect(findItem(template, "Close others").enabled).toBe(false);
    expect(findItem(template, "Copy path").enabled).toBe(false);
    expect(findItem(template, "Close").enabled).toBe(true);
  });

  it("passes the typed target request to the command override", () => {
    const onCommand = vi.fn();
    const options = createOptions({ onCommand });
    const item = findItem(buildMenuTemplate(options), "Reveal in Workspace");

    item.click?.({} as Electron.MenuItem, undefined, undefined);

    expect(onCommand).toHaveBeenCalledWith({
      id: "tab-reveal-in-workspace",
      args: options.target
    });
    expect(options.onRevealInWorkspace).not.toHaveBeenCalled();
  });

  it("routes through existing callbacks and quietly rejects stale unavailable commands", async () => {
    const options = createOptions();
    const request = { id: "tab-close-others", args: options.target } as const;

    await executeTabMenuCommand(request, options);
    expect(options.onCloseOthers).toHaveBeenCalledOnce();

    options.canCloseOthers = false;
    await executeTabMenuCommand(request, options);
    expect(options.onCloseOthers).toHaveBeenCalledOnce();
  });
});
