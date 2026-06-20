import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => template
  }
}));

import { buildTabContextMenu } from "../../../src/main/menus/tabContextMenu";

function buildMenuTemplate(includeFileActions = true) {
  return buildTabContextMenu({
    canCloseAll: true,
    canCloseOthers: true,
    canCloseSavedTabs: true,
    canCopyPath: true,
    canRename: true,
    canRevealInWorkspace: true,
    canShowInFolder: true,
    includeFileActions,
    onClose: vi.fn(),
    onCloseAll: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseSavedTabs: vi.fn(),
    onCopyPath: vi.fn(),
    onRename: vi.fn(),
    onRevealInWorkspace: vi.fn(),
    onShowInFolder: vi.fn()
  }) as unknown as MenuItemConstructorOptions[];
}

describe("buildTabContextMenu", () => {
  it("can build a close-only tab menu", () => {
    expect(buildMenuTemplate(false).map((item) => item.label)).toEqual([
      "Close",
      "Close others",
      "Close saved tabs",
      "Close all tabs"
    ]);
  });

  it("includes file actions for document tabs", () => {
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
});
