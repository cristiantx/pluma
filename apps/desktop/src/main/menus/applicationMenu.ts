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
          label: "New Window",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => options.onCommand("new-window")
        },
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
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
        {
          label: "Paste as Plain Text",
          accelerator: "Shift+CmdOrCtrl+V",
          role: "pasteAndMatchStyle"
        },
        { type: "separator" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", role: "selectAll" },
        { type: "separator" },
        {
          label: "Find",
          accelerator: "CmdOrCtrl+F",
          click: () => options.onCommand("find")
        },
        {
          label: "Find Next",
          accelerator: "CmdOrCtrl+G",
          click: () => options.onCommand("find-next")
        },
        {
          label: "Find Previous",
          accelerator: "Shift+CmdOrCtrl+G",
          click: () => options.onCommand("find-previous")
        },
        {
          label: "Replace",
          accelerator: "Alt+CmdOrCtrl+F",
          click: () => options.onCommand("replace")
        },
        { type: "separator" },
        { label: "Start Dictation...", role: "startSpeaking" }
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
