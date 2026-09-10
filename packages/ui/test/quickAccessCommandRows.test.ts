import { describe, expect, it } from "vitest";
import { getQuickAccessCommandRows } from "../src/shell/quickaccess/quickAccessCommandRows.js";

describe("quick access command ranking", () => {
  it("ranks exact Save before Enable Auto Save regardless of registry ordering", () => {
    const rows = getQuickAccessCommandRows(
      { hasActiveDocument: true, autosaveEnabled: false },
      "Save",
      "darwin"
    );
    expect(rows[0]?.label).toBe("Save");
    const autosave = rows.findIndex((row) => row.label === "Enable Auto Save");
    expect(autosave).toBeGreaterThan(0);
    expect(rows[0]?.labelMatches).toEqual([{ start: 0, end: 4 }]);
  });

  it("keeps an exact unavailable Save discoverable ahead of weaker enabled matches", () => {
    const rows = getQuickAccessCommandRows(
      { hasActiveDocument: false, autosaveEnabled: false },
      "save",
      "linux"
    );
    expect(rows[0]).toMatchObject({ label: "Save", disabled: true });
    expect(rows.find((row) => row.label === "Enable Auto Save")?.disabled).toBe(
      false
    );
  });
});
