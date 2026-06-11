import { Menu, type MenuItemConstructorOptions } from "electron";

export type WorkspaceContextMenuOptions = {
  canFindInFolder: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onCut: () => void;
  onMoveToTrash: () => void;
  onFindInFolder: () => void;
  onNewDirectory: () => void;
  onNewFile: () => void;
  onPaste: () => void;
  onRename: () => void;
  onShowInFolder: () => void;
};

export function buildWorkspaceContextMenu(
  options: WorkspaceContextMenuOptions
): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "New File",
      click: options.onNewFile
    },
    {
      label: "New Directory",
      click: options.onNewDirectory
    },
    { type: "separator" },
    {
      label: "Copy",
      click: options.onCopy
    },
    {
      label: "Cut",
      click: options.onCut
    },
    {
      enabled: options.canPaste,
      label: "Paste",
      click: options.onPaste
    },
    { type: "separator" },
    {
      label: "Rename",
      click: options.onRename
    },
    {
      label: "Move To Trash",
      click: options.onMoveToTrash
    },
    { type: "separator" },
    {
      enabled: options.canFindInFolder,
      label: "Find In Folder",
      click: options.onFindInFolder
    },
    {
      label: "Show In Folder",
      click: options.onShowInFolder
    }
  ];

  return Menu.buildFromTemplate(template);
}
