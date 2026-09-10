import {
  getCommandState,
  type CommandContext,
  type CommandRequest
} from "@pluma/commands";
import { Menu, type MenuItemConstructorOptions } from "electron";

import { commandMenuItem } from "./commandMenuItem";

export type WorkspaceMenuCommandRequest = Extract<
  CommandRequest,
  { id: `workspace-${string}` }
>;

export type WorkspaceContextMenuOptions = {
  target: { path: string; kind: "file" | "folder" };
  canFindInFolder: boolean;
  canPaste: boolean;
  onCommand?: (request: WorkspaceMenuCommandRequest) => void;
  onCopy: () => void | Promise<unknown>;
  onCut: () => void | Promise<unknown>;
  onMoveToTrash: () => void | Promise<unknown>;
  onFindInFolder: () => void | Promise<unknown>;
  onNewDirectory: () => void | Promise<unknown>;
  onNewFile: () => void | Promise<unknown>;
  onPaste: () => void | Promise<unknown>;
  onRename: () => void | Promise<unknown>;
  onShowInFolder: () => void | Promise<unknown>;
};

export function buildWorkspaceContextMenu(
  options: WorkspaceContextMenuOptions
): Menu {
  const context = getWorkspaceCommandContext(options);
  const item = (id: WorkspaceMenuCommandRequest["id"]) => {
    const request = { id, args: options.target } as WorkspaceMenuCommandRequest;

    return commandMenuItem(
      request,
      context,
      () => {
        if (options.onCommand) {
          options.onCommand(request);
        } else {
          void executeWorkspaceMenuCommand(request, options);
        }
      },
      getCommandPlatform()
    );
  };
  const template: MenuItemConstructorOptions[] = [
    item("workspace-new-file"),
    item("workspace-new-directory"),
    { type: "separator" },
    item("workspace-copy"),
    item("workspace-cut"),
    item("workspace-paste"),
    { type: "separator" },
    item("workspace-rename"),
    item("workspace-trash"),
    { type: "separator" },
    item("workspace-find-in-folder"),
    item("workspace-show-in-folder")
  ];

  return Menu.buildFromTemplate(template);
}

export async function executeWorkspaceMenuCommand(
  request: WorkspaceMenuCommandRequest,
  options: WorkspaceContextMenuOptions
): Promise<void> {
  if (
    !getCommandState(request.id, getWorkspaceCommandContext(options)).enabled
  ) {
    return;
  }

  const handlers: Record<
    WorkspaceMenuCommandRequest["id"],
    () => void | Promise<unknown>
  > = {
    "workspace-copy": options.onCopy,
    "workspace-cut": options.onCut,
    "workspace-find-in-folder": options.onFindInFolder,
    "workspace-new-directory": options.onNewDirectory,
    "workspace-new-file": options.onNewFile,
    "workspace-paste": options.onPaste,
    "workspace-rename": options.onRename,
    "workspace-show-in-folder": options.onShowInFolder,
    "workspace-trash": options.onMoveToTrash
  };

  await handlers[request.id]();
}

function getWorkspaceCommandContext(
  options: WorkspaceContextMenuOptions
): CommandContext {
  return {
    canFindInFolder: options.canFindInFolder,
    canPaste: options.canPaste
  };
}

function getCommandPlatform(): "darwin" | "win32" | "linux" {
  return process.platform === "darwin" || process.platform === "win32"
    ? process.platform
    : "linux";
}
