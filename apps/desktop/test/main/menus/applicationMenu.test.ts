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
  const onConvertLineEndings = vi.fn();
  const onSetSpellcheckEnabled = vi.fn();
  const template = buildApplicationMenu({
    autosaveEnabled: true,
    commandAvailability: {
      hasActiveDocument
    },
    isDevelopment: false,
    spellcheckEnabled,
    onCommand: vi.fn(),
    onConvertLineEndings,
    onSetAutosaveEnabled: vi.fn(),
    onSetSpellcheckEnabled
  }) as unknown as MenuItemConstructorOptions[];

  return {
    onConvertLineEndings,
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
