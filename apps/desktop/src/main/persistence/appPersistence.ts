import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  defaultAppSettings,
  isDefaultLineEnding,
  isEditorWidthPreference,
  isRichEditorDensity,
  isSourceEditorFontFamily,
  isSourceEditorFontSize,
  isSourceEditorTabSize,
  isThemePreference,
  type AppSettings
} from "@pluma/ui";

import type { EditorViewMode } from "../../shared/shellState";

export { defaultAppSettings };

export type PersistedDocumentReference =
  | {
      kind: "app-draft";
      draftId: string;
      editorMode?: EditorViewMode;
      name: string;
    }
  | {
      editorMode?: EditorViewMode;
      kind: "desktop-path";
      path: string;
    };

type PersistedEditorMode = EditorViewMode | "split";

type PersistedSessionState = {
  activeDocumentRef?: PersistedDocumentReference | null;
  activeDocumentPath: string | null;
  documentRefs?: PersistedDocumentReference[];
  documentPaths: string[];
  editorMode: EditorViewMode;
  paneSizes?: number[];
  workspacePath: string | null;
};

export type PersistedWindowSessionState = PersistedSessionState;

export type PersistedMultiWindowSessionState = {
  activeWindowIndex: number;
  windows: PersistedWindowSessionState[];
};

type PersistedSessionStateCandidate = Omit<
  PersistedSessionState,
  "editorMode"
> & {
  editorMode: PersistedEditorMode;
};

type PersistedMultiWindowSessionStateCandidate = {
  activeWindowIndex: number;
  windows: PersistedSessionStateCandidate[];
};

export function isEditorViewMode(value: unknown): value is EditorViewMode {
  return value === "source" || value === "rich";
}

export async function readAppSettings(filePath: string): Promise<AppSettings> {
  const parsedSettings = await readJsonFile(filePath);

  if (!isAppSettings(parsedSettings)) {
    return defaultAppSettings;
  }

  return normalizeAppSettings(parsedSettings);
}

export async function writeAppSettings(
  filePath: string,
  settings: AppSettings
): Promise<void> {
  await writeJsonFile(filePath, settings);
}

export async function readPersistedSessionState(
  filePath: string
): Promise<PersistedMultiWindowSessionState | null> {
  const parsedState = await readJsonFile(filePath);

  return normalizePersistedSessionState(parsedState);
}

export async function writePersistedSessionState(
  filePath: string,
  state: PersistedMultiWindowSessionState
): Promise<void> {
  await writeJsonFile(filePath, state);
}

export function normalizePersistedSessionState(
  value: unknown
): PersistedMultiWindowSessionState | null {
  if (isPersistedMultiWindowSessionState(value)) {
    const normalizedWindows = value.windows.map(
      normalizePersistedWindowSessionState
    );
    const activeWindow = normalizedWindows[value.activeWindowIndex] ?? null;
    const windows = normalizedWindows.filter(isMeaningfulPersistedWindowState);
    const activeWindowIndex = activeWindow
      ? windows.indexOf(activeWindow)
      : value.activeWindowIndex;

    return {
      activeWindowIndex: normalizeActiveWindowIndex(
        activeWindowIndex,
        windows.length
      ),
      windows
    };
  }

  if (isPersistedSessionState(value)) {
    const windowState = normalizePersistedWindowSessionState(value);

    return isMeaningfulPersistedWindowState(windowState)
      ? {
          activeWindowIndex: 0,
          windows: [windowState]
        }
      : {
          activeWindowIndex: 0,
          windows: []
        };
  }

  return null;
}

export function isMeaningfulPersistedWindowState(
  state: PersistedWindowSessionState
): boolean {
  return (
    (state.documentRefs?.length ?? 0) > 0 ||
    state.documentPaths.length > 0 ||
    state.workspacePath !== null ||
    (state.paneSizes?.length ?? 0) > 0
  );
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const rawJson = await readFile(filePath, "utf8");

    if (rawJson.trim() === "") {
      return null;
    }

    return JSON.parse(rawJson) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppSettings>;

  return (
    (candidate.autosaveEnabled === undefined ||
      typeof candidate.autosaveEnabled === "boolean") &&
    (candidate.spellcheckEnabled === undefined ||
      typeof candidate.spellcheckEnabled === "boolean") &&
    (candidate.richEditorWidth === undefined ||
      isEditorWidthPreference(candidate.richEditorWidth)) &&
    (candidate.sourceEditorWidth === undefined ||
      isEditorWidthPreference(candidate.sourceEditorWidth)) &&
    (candidate.sourceEditorFontFamily === undefined ||
      isSourceEditorFontFamily(candidate.sourceEditorFontFamily)) &&
    (candidate.sourceEditorColorScheme === undefined ||
      candidate.sourceEditorColorScheme === "follow-theme" ||
      candidate.sourceEditorColorScheme === "pluma-dark" ||
      candidate.sourceEditorColorScheme === "pluma-light") &&
    (candidate.sourceEditorFontSize === undefined ||
      isSourceEditorFontSize(candidate.sourceEditorFontSize)) &&
    (candidate.sourceEditorLineNumbers === undefined ||
      typeof candidate.sourceEditorLineNumbers === "boolean") &&
    (candidate.sourceEditorTabSize === undefined ||
      isSourceEditorTabSize(candidate.sourceEditorTabSize)) &&
    (candidate.sourceEditorWordWrap === undefined ||
      typeof candidate.sourceEditorWordWrap === "boolean") &&
    (candidate.richEditorDensity === undefined ||
      isRichEditorDensity(candidate.richEditorDensity)) &&
    (candidate.defaultLineEnding === undefined ||
      isDefaultLineEnding(candidate.defaultLineEnding)) &&
    (candidate.openExportedFile === undefined ||
      typeof candidate.openExportedFile === "boolean") &&
    (candidate.restorePreviousSession === undefined ||
      typeof candidate.restorePreviousSession === "boolean") &&
    (candidate.workspaceSearchCaseSensitive === undefined ||
      typeof candidate.workspaceSearchCaseSensitive === "boolean") &&
    (candidate.workspaceSearchRegexp === undefined ||
      typeof candidate.workspaceSearchRegexp === "boolean") &&
    (candidate.workspaceSearchWholeWord === undefined ||
      typeof candidate.workspaceSearchWholeWord === "boolean") &&
    (candidate.workspaceShowHiddenFiles === undefined ||
      typeof candidate.workspaceShowHiddenFiles === "boolean") &&
    typeof candidate.themePreference === "string" &&
    isThemePreference(candidate.themePreference)
  );
}

function normalizeAppSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    autosaveEnabled:
      settings.autosaveEnabled ?? defaultAppSettings.autosaveEnabled,
    defaultLineEnding:
      settings.defaultLineEnding ?? defaultAppSettings.defaultLineEnding,
    openExportedFile:
      settings.openExportedFile ?? defaultAppSettings.openExportedFile,
    richEditorDensity:
      settings.richEditorDensity ?? defaultAppSettings.richEditorDensity,
    richEditorWidth:
      settings.richEditorWidth ?? defaultAppSettings.richEditorWidth,
    restorePreviousSession:
      settings.restorePreviousSession ??
      defaultAppSettings.restorePreviousSession,
    sourceEditorColorScheme:
      settings.sourceEditorColorScheme ??
      defaultAppSettings.sourceEditorColorScheme,
    sourceEditorFontFamily:
      settings.sourceEditorFontFamily ??
      defaultAppSettings.sourceEditorFontFamily,
    sourceEditorFontSize:
      settings.sourceEditorFontSize ?? defaultAppSettings.sourceEditorFontSize,
    sourceEditorLineNumbers:
      settings.sourceEditorLineNumbers ??
      defaultAppSettings.sourceEditorLineNumbers,
    sourceEditorTabSize:
      settings.sourceEditorTabSize ?? defaultAppSettings.sourceEditorTabSize,
    sourceEditorWordWrap:
      settings.sourceEditorWordWrap ?? defaultAppSettings.sourceEditorWordWrap,
    sourceEditorWidth:
      settings.sourceEditorWidth ?? defaultAppSettings.sourceEditorWidth,
    spellcheckEnabled:
      settings.spellcheckEnabled ?? defaultAppSettings.spellcheckEnabled,
    themePreference:
      settings.themePreference ?? defaultAppSettings.themePreference,
    workspaceSearchCaseSensitive:
      settings.workspaceSearchCaseSensitive ??
      defaultAppSettings.workspaceSearchCaseSensitive,
    workspaceSearchRegexp:
      settings.workspaceSearchRegexp ??
      defaultAppSettings.workspaceSearchRegexp,
    workspaceSearchWholeWord:
      settings.workspaceSearchWholeWord ??
      defaultAppSettings.workspaceSearchWholeWord,
    workspaceShowHiddenFiles:
      settings.workspaceShowHiddenFiles ??
      defaultAppSettings.workspaceShowHiddenFiles
  };
}

function isPersistedSessionState(
  value: unknown
): value is PersistedSessionStateCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedSessionStateCandidate>;

  return (
    (candidate.activeDocumentPath === null ||
      typeof candidate.activeDocumentPath === "string") &&
    (candidate.activeDocumentRef === undefined ||
      candidate.activeDocumentRef === null ||
      isPersistedDocumentReference(candidate.activeDocumentRef)) &&
    Array.isArray(candidate.documentPaths) &&
    candidate.documentPaths.every(
      (documentPath) => typeof documentPath === "string"
    ) &&
    (candidate.documentRefs === undefined ||
      (Array.isArray(candidate.documentRefs) &&
        candidate.documentRefs.every(isPersistedDocumentReference))) &&
    isPersistedEditorMode(candidate.editorMode) &&
    (candidate.paneSizes === undefined ||
      (Array.isArray(candidate.paneSizes) &&
        candidate.paneSizes.every(
          (paneSize) => typeof paneSize === "number"
        ))) &&
    (candidate.workspacePath === null ||
      typeof candidate.workspacePath === "string")
  );
}

function isPersistedDocumentReference(
  value: unknown
): value is PersistedDocumentReference {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedDocumentReference>;

  if (candidate.kind === "desktop-path") {
    return (
      typeof candidate.path === "string" &&
      (candidate.editorMode === undefined ||
        isEditorViewMode(candidate.editorMode))
    );
  }

  if (candidate.kind === "app-draft") {
    return (
      typeof candidate.draftId === "string" &&
      (candidate.editorMode === undefined ||
        isEditorViewMode(candidate.editorMode)) &&
      typeof candidate.name === "string"
    );
  }

  return false;
}

function isPersistedMultiWindowSessionState(
  value: unknown
): value is PersistedMultiWindowSessionStateCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedMultiWindowSessionState>;

  return (
    typeof candidate.activeWindowIndex === "number" &&
    Array.isArray(candidate.windows) &&
    candidate.windows.every(isPersistedSessionState)
  );
}

function isPersistedEditorMode(value: unknown): value is PersistedEditorMode {
  return isEditorViewMode(value) || value === "split";
}

function normalizePersistedEditorMode(
  editorMode: PersistedEditorMode
): EditorViewMode {
  return editorMode === "split" ? "source" : editorMode;
}

function normalizePersistedWindowSessionState(
  state: PersistedSessionStateCandidate
): PersistedWindowSessionState {
  return {
    ...state,
    editorMode: normalizePersistedEditorMode(state.editorMode)
  };
}

function normalizeActiveWindowIndex(
  activeWindowIndex: number,
  windowCount: number
): number {
  if (windowCount === 0) {
    return 0;
  }

  if (
    Number.isInteger(activeWindowIndex) &&
    activeWindowIndex >= 0 &&
    activeWindowIndex < windowCount
  ) {
    return activeWindowIndex;
  }

  return 0;
}
