import {
  getCommandState,
  type CommandContext,
  type CommandRequest
} from "@pluma/commands";
import { Menu, type MenuItemConstructorOptions } from "electron";

import { commandMenuItem } from "./commandMenuItem";

export type TabMenuCommandRequest = Extract<
  CommandRequest,
  { id: `tab-${string}` }
>;

export type TabContextMenuOptions = {
  target: { tabId: string; tabIds: string[] };
  canCloseAll: boolean;
  canCloseOthers: boolean;
  canCopyPath: boolean;
  canRename: boolean;
  canRevealInWorkspace: boolean;
  canShowInFolder: boolean;
  canCloseSavedTabs: boolean;
  includeFileActions?: boolean;
  onCommand?: (request: TabMenuCommandRequest) => void;
  onClose: () => void | Promise<unknown>;
  onCloseAll: () => void | Promise<unknown>;
  onCloseOthers: () => void | Promise<unknown>;
  onCloseSavedTabs: () => void | Promise<unknown>;
  onCopyPath: () => void | Promise<unknown>;
  onRename: () => void | Promise<unknown>;
  onRevealInWorkspace: () => void | Promise<unknown>;
  onShowInFolder: () => void | Promise<unknown>;
};

export function buildTabContextMenu(options: TabContextMenuOptions): Menu {
  const context = getTabCommandContext(options);
  const item = (id: TabMenuCommandRequest["id"]) => {
    const request = { id, args: options.target } as TabMenuCommandRequest;

    return commandMenuItem(
      request,
      context,
      () => {
        if (options.onCommand) {
          options.onCommand(request);
        } else {
          void executeTabMenuCommand(request, options);
        }
      },
      getCommandPlatform()
    );
  };
  const template: MenuItemConstructorOptions[] = [
    item("tab-close"),
    item("tab-close-others"),
    item("tab-close-saved"),
    item("tab-close-all")
  ];

  if (options.includeFileActions === false) {
    return Menu.buildFromTemplate(template);
  }

  template.push(
    { type: "separator" },
    item("tab-rename"),
    item("tab-copy-path"),
    item("tab-show-in-folder"),
    item("tab-reveal-in-workspace")
  );

  return Menu.buildFromTemplate(template);
}

export async function executeTabMenuCommand(
  request: TabMenuCommandRequest,
  options: TabContextMenuOptions
): Promise<void> {
  if (!getCommandState(request.id, getTabCommandContext(options)).enabled) {
    return;
  }

  const handlers: Record<
    TabMenuCommandRequest["id"],
    () => void | Promise<unknown>
  > = {
    "tab-close": options.onClose,
    "tab-close-all": options.onCloseAll,
    "tab-close-others": options.onCloseOthers,
    "tab-close-saved": options.onCloseSavedTabs,
    "tab-copy-path": options.onCopyPath,
    "tab-rename": options.onRename,
    "tab-reveal-in-workspace": options.onRevealInWorkspace,
    "tab-show-in-folder": options.onShowInFolder
  };

  await handlers[request.id]();
}

function getTabCommandContext(options: TabContextMenuOptions): CommandContext {
  return {
    canCloseAll: options.canCloseAll,
    canCloseOthers: options.canCloseOthers,
    canCloseSavedTabs: options.canCloseSavedTabs,
    canCopyPath: options.canCopyPath,
    canRename: options.canRename,
    canRevealInWorkspace: options.canRevealInWorkspace,
    canShowInFolder: options.canShowInFolder
  };
}

function getCommandPlatform(): "darwin" | "win32" | "linux" {
  return process.platform === "darwin" || process.platform === "win32"
    ? process.platform
    : "linux";
}
