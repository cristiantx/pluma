import { Menu, type MenuItemConstructorOptions } from "electron";

export type TabContextMenuOptions = {
  canCloseAll: boolean;
  canCloseOthers: boolean;
  canCopyPath: boolean;
  canRename: boolean;
  canRevealInWorkspace: boolean;
  canShowInFolder: boolean;
  canCloseSavedTabs: boolean;
  includeFileActions?: boolean;
  onClose: () => void;
  onCloseAll: () => void;
  onCloseOthers: () => void;
  onCloseSavedTabs: () => void;
  onCopyPath: () => void;
  onRename: () => void;
  onRevealInWorkspace: () => void;
  onShowInFolder: () => void;
};

export function buildTabContextMenu(options: TabContextMenuOptions): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Close",
      click: options.onClose
    },
    {
      enabled: options.canCloseOthers,
      label: "Close others",
      click: options.onCloseOthers
    },
    {
      enabled: options.canCloseSavedTabs,
      label: "Close saved tabs",
      click: options.onCloseSavedTabs
    },
    {
      enabled: options.canCloseAll,
      label: "Close all tabs",
      click: options.onCloseAll
    }
  ];

  if (options.includeFileActions === false) {
    return Menu.buildFromTemplate(template);
  }

  template.push(
    { type: "separator" },
    {
      enabled: options.canRename,
      label: "Rename",
      click: options.onRename
    },
    {
      enabled: options.canCopyPath,
      label: "Copy path",
      click: options.onCopyPath
    },
    {
      enabled: options.canShowInFolder,
      label: "Show in folder",
      click: options.onShowInFolder
    },
    {
      enabled: options.canRevealInWorkspace,
      label: "Reveal in Workspace",
      click: options.onRevealInWorkspace
    }
  );

  return Menu.buildFromTemplate(template);
}
