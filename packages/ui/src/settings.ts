import type { ThemePreference } from "./theme.js";

export type EditorWidthPreference = "default" | "full" | "narrow" | "wide";
export type RichEditorDensity = "comfortable" | "compact";
export type SplitViewOrder = "rich-source" | "source-rich";
export type DefaultLineEnding = "crlf" | "lf" | "system";

export type AppSettings = {
  autosaveEnabled: boolean;
  defaultLineEnding: DefaultLineEnding;
  richEditorDensity: RichEditorDensity;
  richEditorWidth: EditorWidthPreference;
  sourceEditorWidth: EditorWidthPreference;
  spellcheckEnabled: boolean;
  splitViewOrder: SplitViewOrder;
  themePreference: ThemePreference;
};

export const defaultAppSettings: AppSettings = {
  autosaveEnabled: true,
  defaultLineEnding: "system",
  richEditorDensity: "comfortable",
  richEditorWidth: "default",
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
