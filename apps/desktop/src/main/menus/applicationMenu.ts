import { app, Menu, type MenuItemConstructorOptions } from "electron";

import type { CommandName } from "../../shared/shellState";

export type ApplicationMenuCommandAvailability = {
  hasActiveDocument: boolean;
};

export type ApplicationMenuOptions = {
  autosaveEnabled: boolean;
  commandAvailability: ApplicationMenuCommandAvailability;
  isDevelopment: boolean;
  spellcheckEnabled: boolean;
  onCommand: (command: CommandName) => void;
  onConvertLineEndings: (target: "crlf" | "lf") => void;
  onSetAutosaveEnabled: (enabled: boolean) => void;
  onSetSpellcheckEnabled: (enabled: boolean) => void;
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
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => options.onCommand("open-settings")
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("save")
        },
        {
          label: "Save As",
          accelerator: "CmdOrCtrl+Shift+S",
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("save-as")
        },
        { type: "separator" },
        {
          label: "Export as HTML...",
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("export-html")
        },
        {
          label: "Export as PDF...",
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("export-pdf")
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
          enabled: options.commandAvailability.hasActiveDocument,
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
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("find")
        },
        {
          label: "Find Next",
          accelerator: "CmdOrCtrl+G",
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("find-next")
        },
        {
          label: "Find Previous",
          accelerator: "Shift+CmdOrCtrl+G",
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("find-previous")
        },
        {
          label: "Replace",
          accelerator: "Alt+CmdOrCtrl+F",
          enabled: options.commandAvailability.hasActiveDocument,
          click: () => options.onCommand("replace")
        },
        {
          label: "Convert Line Endings To",
          enabled: options.commandAvailability.hasActiveDocument,
          submenu: [
            {
              label: "LF",
              click: () => options.onConvertLineEndings("lf")
            },
            {
              label: "CRLF",
              click: () => options.onConvertLineEndings("crlf")
            }
          ]
        },
        { type: "separator" },
        {
          checked: options.spellcheckEnabled,
          click: (menuItem) => {
            options.onSetSpellcheckEnabled(menuItem.checked);
          },
          label: "Check Spelling While Typing",
          type: "checkbox"
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
          enabled: options.commandAvailability.hasActiveDocument,
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
