import { app, Menu, type MenuItemConstructorOptions } from "electron";

import type { CommandName } from "../../shared/shellState";

export type ApplicationMenuOptions = {
  autosaveEnabled: boolean;
  isDevelopment: boolean;
  onCommand: (command: CommandName) => void;
  onSetAutosaveEnabled: (enabled: boolean) => void;
};

export function buildApplicationMenu(options: ApplicationMenuOptions): Menu {
  const windowSubmenu: MenuItemConstructorOptions[] =
    process.platform === "darwin"
      ? [{ role: "minimize" }, { role: "zoom" }, { role: "front" }]
      : [{ role: "minimize" }, { role: "zoom" }, { role: "close" }];

  return Menu.buildFromTemplate([
    ...getAppMenu(),
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: () => options.onCommand("new-file")
        },
        {
          label: "Open File",
          accelerator: "CmdOrCtrl+O",
          click: () => options.onCommand("open-file")
        },
        {
          label: "Open Folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => options.onCommand("open-folder")
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => options.onCommand("save")
        },
        {
          label: "Save As",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => options.onCommand("save-as")
        },
        { type: "separator" },
        {
          checked: options.autosaveEnabled,
          click: (menuItem) => {
            options.onSetAutosaveEnabled(menuItem.checked);
          },
          label: "Auto Save",
          type: "checkbox"
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => options.onCommand("close-active-tab")
        },
        ...(process.platform === "darwin"
          ? []
          : [
              {
                label: "Quit",
                role: "quit"
              } satisfies MenuItemConstructorOptions
            ])
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Rich/Source Mode",
          accelerator: "CmdOrCtrl+\\",
          click: () => options.onCommand("toggle-mode")
        },
        ...(options.isDevelopment
          ? [
              {
                label: "Open DevTools",
                accelerator:
                  process.platform === "darwin"
                    ? "Alt+Command+I"
                    : "Ctrl+Shift+I",
                click: () => options.onCommand("open-devtools")
              } satisfies MenuItemConstructorOptions
            ]
          : []),
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" }
      ]
    },
    {
      label: "Window",
      submenu: windowSubmenu
    }
  ]);
}

function getAppMenu(): MenuItemConstructorOptions[] {
  return process.platform === "darwin"
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        }
      ]
    : [];
}
