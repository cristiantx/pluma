import {
  type CommandContext,
  type CommandPlatform,
  type CommandRequest
} from "@pluma/commands";
import { app, Menu, type MenuItemConstructorOptions } from "electron";

import { commandMenuItem } from "./commandMenuItem";

type ApplicationMenuCommandAvailability = CommandContext;

export type ApplicationMenuOptions = {
  autosaveEnabled: boolean;
  commandAvailability: ApplicationMenuCommandAvailability;
  isDevelopment: boolean;
  spellcheckEnabled: boolean;
  onCommand: (command: CommandRequest) => void;
};

export function buildApplicationMenu(options: ApplicationMenuOptions): Menu {
  const platform = getCommandPlatform();
  const context: CommandContext = {
    canCloseActiveTab: options.commandAvailability.hasActiveDocument ?? false,
    ...options.commandAvailability,
    autosaveEnabled: options.autosaveEnabled,
    isDevelopment: options.isDevelopment,
    spellcheckEnabled: options.spellcheckEnabled
  };
  const item = (request: CommandRequest) =>
    commandMenuItem(request, context, options.onCommand, platform);
  const convertLineEndings = item({
    id: "convert-line-endings",
    args: { target: "lf" }
  });
  delete convertLineEndings.click;

  return Menu.buildFromTemplate([
    ...getAppMenu(item, platform),
    {
      label: "File",
      submenu: [
        item({ id: "new-window" }),
        item({ id: "new-file" }),
        item({ id: "open-file" }),
        item({ id: "open-folder" }),
        item({ id: "quick-open" }),
        item({ id: "open-settings" }),
        { type: "separator" },
        item({ id: "save" }),
        item({ id: "save-as" }),
        { type: "separator" },
        item({ id: "export-html" }),
        item({ id: "export-pdf" }),
        { type: "separator" },
        item({
          id: "set-autosave-enabled",
          args: { enabled: options.autosaveEnabled }
        }),
        { type: "separator" },
        item({ id: "close-active-tab" }),
        ...(platform === "darwin" ? [] : [item({ id: "native-quit" })])
      ]
    },
    {
      label: "Edit",
      submenu: [
        item({ id: "native-undo" }),
        item({ id: "native-redo" }),
        { type: "separator" },
        item({ id: "native-cut" }),
        item({ id: "native-copy" }),
        item({ id: "native-paste" }),
        item({ id: "native-pasteAndMatchStyle" }),
        { type: "separator" },
        item({ id: "native-selectAll" }),
        { type: "separator" },
        item({ id: "find" }),
        item({ id: "find-next" }),
        item({ id: "find-previous" }),
        item({ id: "replace" }),
        {
          ...convertLineEndings,
          submenu: [
            {
              ...item({ id: "convert-line-endings", args: { target: "lf" } }),
              label: "LF"
            },
            {
              ...item({
                id: "convert-line-endings",
                args: { target: "crlf" }
              }),
              label: "CRLF"
            }
          ]
        },
        { type: "separator" },
        item({
          id: "set-spellcheck-enabled",
          args: { enabled: options.spellcheckEnabled }
        }),
        { type: "separator" },
        item({ id: "native-startSpeaking" })
      ]
    },
    {
      label: "View",
      submenu: [
        item({ id: "command-palette" }),
        item({ id: "toggle-mode" }),
        ...(options.isDevelopment ? [item({ id: "open-devtools" })] : []),
        { type: "separator" },
        item({ id: "reload-window" }),
        item({ id: "force-reload-window" }),
        item({ id: "native-toggleDevTools" })
      ]
    },
    {
      label: "Window",
      submenu: [
        item({ id: "native-minimize" }),
        item({ id: "native-zoom" }),
        item({ id: platform === "darwin" ? "native-front" : "native-close" })
      ]
    }
  ]);
}

function getAppMenu(
  item: (request: CommandRequest) => MenuItemConstructorOptions,
  platform: CommandPlatform
): MenuItemConstructorOptions[] {
  return platform === "darwin"
    ? [
        {
          label: app.name,
          submenu: [
            item({ id: "native-about" }),
            { type: "separator" },
            item({ id: "native-services" }),
            { type: "separator" },
            item({ id: "native-hide" }),
            item({ id: "native-hideOthers" }),
            item({ id: "native-unhide" }),
            { type: "separator" },
            item({ id: "native-quit" })
          ]
        }
      ]
    : [];
}

function getCommandPlatform(): CommandPlatform {
  if (process.platform === "darwin" || process.platform === "win32") {
    return process.platform;
  }

  return "linux";
}
