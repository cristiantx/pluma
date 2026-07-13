import { describe, expect, it } from "vitest";

import { getAppSettingsUpdate } from "../../../src/main/settings/appSettingsUpdate";

describe("getAppSettingsUpdate", () => {
  it("keeps valid fields and ignores invalid or unknown values", () => {
    expect(
      getAppSettingsUpdate({
        autosaveEnabled: false,
        sourceEditorColorScheme: "pluma-dark",
        sourceEditorFontSize: 99,
        themePreference: "dark",
        unknownSetting: true
      })
    ).toEqual({
      autosaveEnabled: false,
      sourceEditorColorScheme: "pluma-dark",
      themePreference: "dark"
    });
  });

  it("rejects non-record payloads", () => {
    expect(getAppSettingsUpdate(null)).toEqual({});
    expect(getAppSettingsUpdate("dark")).toEqual({});
  });
});
