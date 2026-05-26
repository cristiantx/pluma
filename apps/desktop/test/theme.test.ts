import { describe, expect, it } from "vitest";

import {
  readStoredThemePreference,
  resolveThemePreference
} from "../src/theme";

describe("readStoredThemePreference", () => {
  it("falls back to system for invalid values", () => {
    expect(readStoredThemePreference("sepia")).toBe("system");
    expect(readStoredThemePreference(null)).toBe("system");
  });
});

describe("resolveThemePreference", () => {
  it("maps system to the OS preference", () => {
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("system", false)).toBe("light");
  });

  it("preserves explicit light and dark choices", () => {
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
  });
});
