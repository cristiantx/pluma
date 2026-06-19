import type { ThemePreference } from "./theme.js";

export type EditorWidthPreference = "default" | "full" | "narrow" | "wide";
export type RichEditorDensity = "comfortable" | "compact";
export type SplitViewOrder = "rich-source" | "source-rich";
export type DefaultLineEnding = "crlf" | "lf" | "system";
export type SourceEditorFontSize = 12 | 13 | 14 | 15 | 16 | 18;
export type SourceEditorFontFamily = "mono" | "system";
export type SourceEditorTabSize = 2 | 4;

export type AppSettings = {
  autosaveEnabled: boolean;
  defaultLineEnding: DefaultLineEnding;
  richEditorDensity: RichEditorDensity;
  richEditorWidth: EditorWidthPreference;
  sourceEditorWidth: EditorWidthPreference;
  sourceEditorFontFamily: SourceEditorFontFamily;
  sourceEditorFontSize: SourceEditorFontSize;
  sourceEditorLineNumbers: boolean;
  sourceEditorTabSize: SourceEditorTabSize;
  sourceEditorWordWrap: boolean;
  spellcheckEnabled: boolean;
  splitViewOrder: SplitViewOrder;
  themePreference: ThemePreference;
};

export const defaultAppSettings: AppSettings = {
  autosaveEnabled: true,
  defaultLineEnding: "system",
  richEditorDensity: "comfortable",
  richEditorWidth: "default",
  sourceEditorFontFamily: "mono",
  sourceEditorFontSize: 14,
  sourceEditorLineNumbers: true,
  sourceEditorTabSize: 2,
  sourceEditorWordWrap: true,
  sourceEditorWidth: "default",
  spellcheckEnabled: true,
  splitViewOrder: "rich-source",
  themePreference: "system"
};

export function isEditorWidthPreference(
  value: unknown
): value is EditorWidthPreference {
  return (
    value === "default" ||
    value === "full" ||
    value === "narrow" ||
    value === "wide"
  );
}

export function isRichEditorDensity(
  value: unknown
): value is RichEditorDensity {
  return value === "comfortable" || value === "compact";
}

export function isSplitViewOrder(value: unknown): value is SplitViewOrder {
  return value === "rich-source" || value === "source-rich";
}

export function isDefaultLineEnding(
  value: unknown
): value is DefaultLineEnding {
  return value === "crlf" || value === "lf" || value === "system";
}

export function isSourceEditorFontSize(
  value: unknown
): value is SourceEditorFontSize {
  return (
    value === 12 ||
    value === 13 ||
    value === 14 ||
    value === 15 ||
    value === 16 ||
    value === 18
  );
}

export function isSourceEditorFontFamily(
  value: unknown
): value is SourceEditorFontFamily {
  return value === "mono" || value === "system";
}

export function isSourceEditorTabSize(
  value: unknown
): value is SourceEditorTabSize {
  return value === 2 || value === 4;
}
