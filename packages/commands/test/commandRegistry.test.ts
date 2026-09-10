import { describe, expect, it } from "vitest";

import { applicationCommands } from "../src/applicationCommands.js";
import { getCommandState } from "../src/commandAvailability.js";
import {
  commandRegistry,
  isCommandId,
  isEditorCommandId
} from "../src/commandRegistry.js";
import { parseCommandRequest } from "../src/commandRequests.js";
import {
  getCodeMirrorBinding,
  getElectronAccelerator
} from "../src/commandShortcuts.js";
import type {
  CommandDefinition,
  CommandPlatform,
  CommandShortcut
} from "../src/commandTypes.js";
import { documentCommands } from "../src/documentCommands.js";
import { editorCommands } from "../src/editorCommands.js";
import { nativeCommands } from "../src/nativeCommands.js";
import { tabCommands } from "../src/tabCommands.js";
import { workspaceCommands } from "../src/workspaceCommands.js";

const catalogs = [
  applicationCommands,
  documentCommands,
  editorCommands,
  nativeCommands,
  tabCommands,
  workspaceCommands
] as const;

describe("command registry", () => {
  it("contains every catalog entry exactly once", () => {
    const catalogIds = catalogs.flatMap((catalog) => Object.keys(catalog));

    expect(new Set(catalogIds).size).toBe(catalogIds.length);
    expect(Object.keys(commandRegistry).sort()).toEqual(catalogIds.sort());
  });

  it("rejects unknown IDs, malformed payloads, and extra keys", () => {
    expect(isCommandId("missing-command")).toBe(false);
    expect(parseCommandRequest({ id: "missing-command" })).toBeNull();
    expect(parseCommandRequest({ id: "save", extra: true })).toBeNull();
    expect(parseCommandRequest({ id: "save", args: {} })).toBeNull();
    expect(
      parseCommandRequest({
        id: "set-autosave-enabled",
        args: { enabled: true, extra: true }
      })
    ).toBeNull();
    expect(
      parseCommandRequest({
        id: "tab-close",
        args: { tabId: "one", tabIds: ["one", 2] }
      })
    ).toBeNull();
  });

  it("accepts string requests and every typed payload shape", () => {
    expect(parseCommandRequest("save")).toEqual({ id: "save" });
    expect(
      parseCommandRequest({
        id: "set-autosave-enabled",
        args: { enabled: false }
      })
    ).toEqual({ id: "set-autosave-enabled", args: { enabled: false } });
    expect(
      parseCommandRequest({
        id: "convert-line-endings",
        args: { target: "crlf" }
      })
    ).toEqual({ id: "convert-line-endings", args: { target: "crlf" } });
    expect(
      parseCommandRequest({
        id: "tab-close-others",
        args: { tabId: "one", tabIds: ["one", "two"] }
      })
    ).toEqual({
      id: "tab-close-others",
      args: { tabId: "one", tabIds: ["one", "two"] }
    });
    expect(
      parseCommandRequest({
        id: "workspace-new-file",
        args: { path: "/notes", kind: "folder" }
      })
    ).toEqual({
      id: "workspace-new-file",
      args: { path: "/notes", kind: "folder" }
    });
  });

  it("derives availability, development visibility, and checked settings", () => {
    expect(getCommandState("save", {})).toEqual({
      enabled: false,
      visible: true,
      checked: undefined
    });
    expect(getCommandState("save", { hasActiveDocument: true }).enabled).toBe(
      true
    );
    expect(getCommandState("open-devtools", {})).toEqual({
      enabled: false,
      visible: false,
      checked: undefined
    });
    expect(getCommandState("open-devtools", { isDevelopment: true })).toEqual({
      enabled: true,
      visible: true,
      checked: undefined
    });
    expect(
      getCommandState("set-autosave-enabled", { autosaveEnabled: true }).checked
    ).toBe(true);
  });

  it("preserves platform accelerator metadata and source key labels", () => {
    expect(getElectronAccelerator("new-window", "linux")).toBe(
      "CmdOrCtrl+Shift+N"
    );
    expect(getElectronAccelerator("open-devtools", "darwin")).toBe(
      "Alt+Command+I"
    );
    expect(getElectronAccelerator("open-devtools", "win32")).toBe(
      "Ctrl+Shift+I"
    );
    expect(getCodeMirrorBinding("toggle-bold", "linux")).toBe("Mod-b");
    expect(getCodeMirrorBinding("toggle-heading-1", "darwin")).toBe(
      "Mod-Alt-1"
    );
    expect(getCodeMirrorBinding("open-devtools", "darwin")).toBe("Alt-Meta-i");
  });

  it("has no normalized shortcut collisions within a command route", () => {
    const platforms: CommandPlatform[] = ["darwin", "win32", "linux"];

    for (const platform of platforms) {
      const seen = new Map<string, string>();

      for (const [id, definition] of Object.entries(commandRegistry)) {
        const shortcut = getPlatformShortcut(definition, platform);
        if (!shortcut) continue;

        const key = `${definition.route}:${normalizeShortcut(shortcut)}`;
        expect(
          seen.get(key),
          `${platform} collision for ${key}`
        ).toBeUndefined();
        seen.set(key, id);
      }
    }

    expect(isEditorCommandId("native-undo")).toBe(false);
    expect(commandRegistry["native-undo"].route).toBe("native");
    expect(commandRegistry["toggle-bold"].route).toBe("editor");
  });
});

function getPlatformShortcut(
  definition: CommandDefinition,
  platform: CommandPlatform
): CommandShortcut | undefined {
  return definition.platformShortcuts?.[platform] ?? definition.shortcut;
}

function normalizeShortcut(shortcut: CommandShortcut): string {
  return `${[...shortcut.modifiers].sort().join("+")}+${shortcut.key.toLowerCase()}`;
}
