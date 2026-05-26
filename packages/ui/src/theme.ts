export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pluma-theme-preference";

export function isThemePreference(
  value: string | null
): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readStoredThemePreference(
  storageValue: string | null | undefined
): ThemePreference {
  const normalizedValue = storageValue ?? null;

  return isThemePreference(normalizedValue) ? normalizedValue : "system";
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}
