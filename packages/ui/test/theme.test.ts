import { describe, expect, it } from "vitest";

import {
  isThemePreference,
  readStoredThemePreference,
  resolveThemePreference
} from "../src/theme.js";

describe("isThemePreference", () => {
  it("accepts the supported values and rejects other strings", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
  });
});

describe("readStoredThemePreference", () => {
  it("falls back to system when local storage contains an unknown value", () => {
    expect(readStoredThemePreference("sepia")).toBe("system");
    expect(readStoredThemePreference(undefined)).toBe("system");
  });
});

describe("resolveThemePreference", () => {
  it("resolves system based on the OS preference", () => {
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("system", false)).toBe("light");
    expect(resolveThemePreference("light", true)).toBe("light");
  });
});
