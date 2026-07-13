import type { AppSettings } from "../settings.js";
import { resolveThemePreference } from "../theme.js";
import type { PlumaStoreState, ThemeSlice } from "./plumaStoreTypes.js";

type SettingsStateUpdate = Pick<
  PlumaStoreState,
  "settings" | "theme" | "writing"
>;

export function hydrateSettingsState(
  state: PlumaStoreState,
  settings: AppSettings
): SettingsStateUpdate {
  return {
    settings,
    theme: createThemeSlice(
      settings.themePreference,
      state.theme.systemPrefersDark
    ),
    writing: {
      spellcheckEnabled: settings.spellcheckEnabled
    }
  };
}

export function setSystemThemeState(
  state: PlumaStoreState,
  systemPrefersDark: boolean
): Pick<PlumaStoreState, "theme"> {
  return {
    theme: createThemeSlice(state.theme.preference, systemPrefersDark)
  };
}

export function setSpellcheckState(
  state: PlumaStoreState,
  spellcheckEnabled: boolean
): Pick<PlumaStoreState, "settings" | "writing"> {
  return {
    settings: { ...state.settings, spellcheckEnabled },
    writing: { spellcheckEnabled }
  };
}

export function setThemePreferenceState(
  state: PlumaStoreState,
  preference: ThemeSlice["preference"]
): Pick<PlumaStoreState, "settings" | "theme"> {
  return {
    settings: { ...state.settings, themePreference: preference },
    theme: createThemeSlice(preference, state.theme.systemPrefersDark)
  };
}

export function toggleThemeState(
  state: PlumaStoreState
): Pick<PlumaStoreState, "settings" | "theme"> {
  const preference = state.theme.resolvedTheme === "dark" ? "light" : "dark";

  return setThemePreferenceState(state, preference);
}

function createThemeSlice(
  preference: ThemeSlice["preference"],
  systemPrefersDark: boolean
): ThemeSlice {
  return {
    preference,
    resolvedTheme: resolveThemePreference(preference, systemPrefersDark),
    systemPrefersDark
  };
}
