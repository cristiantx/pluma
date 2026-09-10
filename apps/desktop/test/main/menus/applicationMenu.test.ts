import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    name: "Pluma"
  },
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => template
  }
}));

import { buildApplicationMenu } from "../../../src/main/menus/applicationMenu";

function buildMenuTemplate(
  spellcheckEnabled: boolean,
  hasActiveDocument = true
) {
  const onCommand = vi.fn();
  const onConvertLineEndings = vi.fn();
  const onSetAutosaveEnabled = vi.fn();
  const onSetSpellcheckEnabled = vi.fn();
  const template = buildApplicationMenu({
    autosaveEnabled: true,
    commandAvailability: {
      hasActiveDocument
    },
    isDevelopment: false,
    spellcheckEnabled,
    onCommand,
    onConvertLineEndings,
    onSetAutosaveEnabled,
    onSetSpellcheckEnabled
  }) as unknown as MenuItemConstructorOptions[];

  return {
    onCommand,
    onConvertLineEndings,
    onSetAutosaveEnabled,
    onSetSpellcheckEnabled,
    template
  };
}

function getSubmenuItem(
  template: MenuItemConstructorOptions[],
  submenuLabel: string,
  itemLabel: string
): MenuItemConstructorOptions {
  const submenu = template.find((item) => item.label === submenuLabel)
    ?.submenu as MenuItemConstructorOptions[] | undefined;
  const item = submenu?.find((candidate) => candidate.label === itemLabel);

  if (!item) {
    throw new Error(`Menu item not found: ${submenuLabel} > ${itemLabel}`);
  }

  return item;
}

describe("buildApplicationMenu", () => {
  it.each([
    ["File", "New Window", "CmdOrCtrl+Shift+N", "new-window"],
    ["File", "New File", "CmdOrCtrl+N", "new-file"],
    ["File", "Open File", "CmdOrCtrl+O", "open-file"],
    ["File", "Open Folder", "CmdOrCtrl+Shift+O", "open-folder"],
    ["File", "Settings...", "CmdOrCtrl+,", "open-settings"],
    ["File", "Save", "CmdOrCtrl+S", "save"],
    ["File", "Save As", "CmdOrCtrl+Shift+S", "save-as"],
    ["File", "Close Tab", "CmdOrCtrl+W", "close-active-tab"],
    ["Edit", "Find", "CmdOrCtrl+F", "find"],
    ["Edit", "Find Next", "CmdOrCtrl+G", "find-next"],
    ["Edit", "Find Previous", "Shift+CmdOrCtrl+G", "find-previous"],
    ["Edit", "Replace", "Alt+CmdOrCtrl+F", "replace"],
    ["View", "Toggle Rich/Source Mode", "CmdOrCtrl+\\", "toggle-mode"],
    ["View", "Reload", "CmdOrCtrl+R", "reload-window"],
    ["View", "Force Reload", "Shift+CmdOrCtrl+R", "force-reload-window"]
  ])(
    "maps %s > %s (%s) to the %s command",
    (submenuLabel, itemLabel, accelerator, command) => {
      const { onCommand, template } = buildMenuTemplate(true);
      const item = getSubmenuItem(template, submenuLabel, itemLabel);

      expect(item.accelerator).toBe(accelerator);
      item.click?.({} as Electron.MenuItem, undefined, undefined);
      expect(onCommand).toHaveBeenCalledWith(command);
    }
  );

  it("preserves Electron roles for native edit, view, and window actions", () => {
    const { template } = buildMenuTemplate(true);
    const editSubmenu = template.find((item) => item.label === "Edit")
      ?.submenu as MenuItemConstructorOptions[];
    const viewSubmenu = template.find((item) => item.label === "View")
      ?.submenu as MenuItemConstructorOptions[];
    const windowSubmenu = template.find((item) => item.label === "Window")
      ?.submenu as MenuItemConstructorOptions[];

    expect(editSubmenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "undo" }),
        expect.objectContaining({ role: "redo" }),
        expect.objectContaining({ role: "cut" }),
        expect.objectContaining({ role: "copy" }),
        expect.objectContaining({ role: "paste" }),
        expect.objectContaining({ role: "pasteAndMatchStyle" }),
        expect.objectContaining({ role: "selectAll" }),
        expect.objectContaining({ role: "startSpeaking" })
      ])
    );
    expect(viewSubmenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "toggleDevTools" })
      ])
    );
    expect(windowSubmenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "minimize" }),
        expect.objectContaining({ role: "zoom" }),
        expect.objectContaining({
          role: process.platform === "darwin" ? "front" : "close"
        })
      ])
    );
  });

  it("maps the auto-save checkbox state and click value to its handler", () => {
    const { onSetAutosaveEnabled, template } = buildMenuTemplate(true);
    const item = getSubmenuItem(template, "File", "Auto Save");

    expect(item).toMatchObject({
      checked: true,
      type: "checkbox"
    });

    item.click?.({ checked: false } as Electron.MenuItem, undefined, undefined);
    expect(onSetAutosaveEnabled).toHaveBeenCalledWith(false);
  });

  it("includes a checked spellcheck menu item when spellcheck is enabled", () => {
    const { template } = buildMenuTemplate(true);

    expect(
      getSubmenuItem(template, "Edit", "Check Spelling While Typing")
    ).toMatchObject({
      checked: true,
      label: "Check Spelling While Typing",
      type: "checkbox"
    });
  });

  it("includes an unchecked spellcheck menu item when spellcheck is disabled", () => {
    const { template } = buildMenuTemplate(false);

    expect(
      getSubmenuItem(template, "Edit", "Check Spelling While Typing")
    ).toMatchObject({
      checked: false,
      label: "Check Spelling While Typing",
      type: "checkbox"
    });
  });

  it("calls the spellcheck setting handler with the next checked value", () => {
    const { onSetSpellcheckEnabled, template } = buildMenuTemplate(false);
    const item = getSubmenuItem(
      template,
      "Edit",
      "Check Spelling While Typing"
    );

    item.click?.({ checked: true } as Electron.MenuItem, undefined, undefined);

    expect(onSetSpellcheckEnabled).toHaveBeenCalledWith(true);
  });

  it("disables document-based menu actions without an active document", () => {
    const { template } = buildMenuTemplate(true, false);

    expect(getSubmenuItem(template, "File", "Save")).toMatchObject({
      enabled: false
    });
    expect(getSubmenuItem(template, "Edit", "Find")).toMatchObject({
      enabled: false
    });
    expect(
      getSubmenuItem(template, "Edit", "Convert Line Endings To")
    ).toMatchObject({
      enabled: false
    });
    expect(
      getSubmenuItem(template, "View", "Toggle Rich/Source Mode")
    ).toMatchObject({
      enabled: false
    });
  });

  it("converts line endings from the edit submenu", () => {
    const { onConvertLineEndings, template } = buildMenuTemplate(true);
    const item = getSubmenuItem(template, "Edit", "Convert Line Endings To");
    const submenu = item.submenu as MenuItemConstructorOptions[];

    submenu
      .find((candidate) => candidate.label === "CRLF")
      ?.click?.({} as Electron.MenuItem, undefined, undefined);

    expect(onConvertLineEndings).toHaveBeenCalledWith("crlf");
  });
});
