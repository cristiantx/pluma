import {
  isDefaultLineEnding,
  isEditorWidthPreference,
  isRichEditorDensity,
  isSourceEditorColorScheme,
  isSourceEditorFontFamily,
  isSourceEditorFontSize,
  isSourceEditorTabSize,
  isThemePreference,
  type AppSettings
} from "@pluma/ui";

export function getAppSettingsUpdate(settings: unknown): Partial<AppSettings> {
  if (!isRecord(settings)) {
    return {};
  }

  return {
    ...(typeof settings.autosaveEnabled === "boolean"
      ? { autosaveEnabled: settings.autosaveEnabled }
      : {}),
    ...(typeof settings.spellcheckEnabled === "boolean"
      ? { spellcheckEnabled: settings.spellcheckEnabled }
      : {}),
    ...(typeof settings.openExportedFile === "boolean"
      ? { openExportedFile: settings.openExportedFile }
      : {}),
    ...(typeof settings.restorePreviousSession === "boolean"
      ? { restorePreviousSession: settings.restorePreviousSession }
      : {}),
    ...(typeof settings.workspaceRespectGitIgnore === "boolean"
      ? { workspaceRespectGitIgnore: settings.workspaceRespectGitIgnore }
      : {}),
    ...(typeof settings.workspaceShowHiddenFiles === "boolean"
      ? { workspaceShowHiddenFiles: settings.workspaceShowHiddenFiles }
      : {}),
    ...(isEditorWidthPreference(settings.richEditorWidth)
      ? { richEditorWidth: settings.richEditorWidth }
      : {}),
    ...(isEditorWidthPreference(settings.sourceEditorWidth)
      ? { sourceEditorWidth: settings.sourceEditorWidth }
      : {}),
    ...(isSourceEditorFontFamily(settings.sourceEditorFontFamily)
      ? { sourceEditorFontFamily: settings.sourceEditorFontFamily }
      : {}),
    ...(isSourceEditorColorScheme(settings.sourceEditorColorScheme)
      ? { sourceEditorColorScheme: settings.sourceEditorColorScheme }
      : {}),
    ...(isSourceEditorFontSize(settings.sourceEditorFontSize)
      ? { sourceEditorFontSize: settings.sourceEditorFontSize }
      : {}),
    ...(typeof settings.sourceEditorLineNumbers === "boolean"
      ? { sourceEditorLineNumbers: settings.sourceEditorLineNumbers }
      : {}),
    ...(isSourceEditorTabSize(settings.sourceEditorTabSize)
      ? { sourceEditorTabSize: settings.sourceEditorTabSize }
      : {}),
    ...(typeof settings.sourceEditorWordWrap === "boolean"
      ? { sourceEditorWordWrap: settings.sourceEditorWordWrap }
      : {}),
    ...(isRichEditorDensity(settings.richEditorDensity)
      ? { richEditorDensity: settings.richEditorDensity }
      : {}),
    ...(isDefaultLineEnding(settings.defaultLineEnding)
      ? { defaultLineEnding: settings.defaultLineEnding }
      : {}),
    ...(typeof settings.themePreference === "string" &&
    isThemePreference(settings.themePreference)
      ? { themePreference: settings.themePreference }
      : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
