import { describe, expect, it } from "vitest";
import {
  getPaletteEntries,
  parseCommandInvocation,
  parseCommandRequest,
  getCommandShortcutLabel,
  commandRegistry
} from "../src/index.js";

describe("palette contracts", () => {
  it("materializes every visible entry as a validated request", () => {
    const entries = getPaletteEntries({
      hasActiveDocument: true,
      isDevelopment: true
    });
    for (const entry of entries)
      expect(parseCommandRequest(entry.request)).toEqual(entry.request);
    const ids = new Set(entries.map((entry) => entry.commandId));
    for (const [id, definition] of Object.entries(commandRegistry)) {
      if (definition.palette)
        expect(ids.has(id as keyof typeof commandRegistry)).toBe(true);
    }
    expect(
      entries
        .filter((entry) => entry.commandId === "convert-line-endings")
        .map((entry) => entry.key)
    ).toHaveLength(2);
  });
  it("derives toggle arguments at invocation time and hides native/development entries", () => {
    expect(
      getPaletteEntries({ autosaveEnabled: true }).find(
        (entry) => entry.commandId === "set-autosave-enabled"
      )?.request
    ).toEqual({ id: "set-autosave-enabled", args: { enabled: false } });
    expect(
      getPaletteEntries({}).some((entry) => entry.commandId === "open-devtools")
    ).toBe(false);
    expect(
      getPaletteEntries({}).some((entry) =>
        entry.commandId.startsWith("native-")
      )
    ).toBe(false);
    expect(
      getPaletteEntries({}).find((entry) => entry.commandId === "save")?.reason
    ).toBeTruthy();
  });
  it("validates captured identity without accepting arbitrary envelope keys", () => {
    const value = {
      request: { id: "save" },
      context: { activeTabId: "a", documentId: "a", workspaceGeneration: 2 }
    };
    expect(parseCommandInvocation(value)).toEqual(value);
    expect(parseCommandInvocation({ ...value, sender: 1 })).toBeNull();
    expect(
      parseCommandInvocation({
        ...value,
        context: { ...value.context, workspaceGeneration: -1 }
      })
    ).toBeNull();
  });
  it("formats platform shortcuts from their shared definitions", () => {
    expect(getCommandShortcutLabel("quick-open", "darwin")).toBe("⌘P");
    expect(getCommandShortcutLabel("command-palette", "linux")).toBe(
      "Ctrl+Shift+P"
    );
  });
});
