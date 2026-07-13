import { readFile, rename } from "node:fs/promises";

import {
  defaultAppSettings,
  isDefaultLineEnding,
  isEditorWidthPreference,
  isRichEditorDensity,
  isSourceEditorFontFamily,
  isSourceEditorColorScheme,
  isSourceEditorFontSize,
  isSourceEditorTabSize,
  isThemePreference,
  type AppSettings
} from "@pluma/ui";

import type { EditorViewMode } from "../../shared/shellState";
import { writeTextFileAtomic } from "./atomicFile";

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
  return value === "source" || value === "rich" || value === "preview";
}

export async function readAppSettings(filePath: string): Promise<AppSettings> {
  const parsedSettings = await readJsonFile(filePath);

  if (!isRecord(parsedSettings)) {
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
      await preserveCorruptJsonFile(filePath);
      return null;
    }

    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeTextFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeAppSettings(settings: Record<string, unknown>): AppSettings {
  return {
    autosaveEnabled:
      typeof settings.autosaveEnabled === "boolean"
        ? settings.autosaveEnabled
        : defaultAppSettings.autosaveEnabled,
    defaultLineEnding: isDefaultLineEnding(settings.defaultLineEnding)
      ? settings.defaultLineEnding
      : defaultAppSettings.defaultLineEnding,
    openExportedFile:
      typeof settings.openExportedFile === "boolean"
        ? settings.openExportedFile
        : defaultAppSettings.openExportedFile,
    richEditorDensity: isRichEditorDensity(settings.richEditorDensity)
      ? settings.richEditorDensity
      : defaultAppSettings.richEditorDensity,
    richEditorWidth: isEditorWidthPreference(settings.richEditorWidth)
      ? settings.richEditorWidth
      : defaultAppSettings.richEditorWidth,
    restorePreviousSession:
      typeof settings.restorePreviousSession === "boolean"
        ? settings.restorePreviousSession
        : defaultAppSettings.restorePreviousSession,
    sourceEditorColorScheme: isSourceEditorColorScheme(
      settings.sourceEditorColorScheme
    )
      ? settings.sourceEditorColorScheme
      : defaultAppSettings.sourceEditorColorScheme,
    sourceEditorFontFamily: isSourceEditorFontFamily(
      settings.sourceEditorFontFamily
    )
      ? settings.sourceEditorFontFamily
      : defaultAppSettings.sourceEditorFontFamily,
    sourceEditorFontSize: isSourceEditorFontSize(settings.sourceEditorFontSize)
      ? settings.sourceEditorFontSize
      : defaultAppSettings.sourceEditorFontSize,
    sourceEditorLineNumbers:
      typeof settings.sourceEditorLineNumbers === "boolean"
        ? settings.sourceEditorLineNumbers
        : defaultAppSettings.sourceEditorLineNumbers,
    sourceEditorTabSize: isSourceEditorTabSize(settings.sourceEditorTabSize)
      ? settings.sourceEditorTabSize
      : defaultAppSettings.sourceEditorTabSize,
    sourceEditorWordWrap:
      typeof settings.sourceEditorWordWrap === "boolean"
        ? settings.sourceEditorWordWrap
        : defaultAppSettings.sourceEditorWordWrap,
    sourceEditorWidth: isEditorWidthPreference(settings.sourceEditorWidth)
      ? settings.sourceEditorWidth
      : defaultAppSettings.sourceEditorWidth,
    spellcheckEnabled:
      typeof settings.spellcheckEnabled === "boolean"
        ? settings.spellcheckEnabled
        : defaultAppSettings.spellcheckEnabled,
    themePreference:
      typeof settings.themePreference === "string" &&
      isThemePreference(settings.themePreference)
        ? settings.themePreference
        : defaultAppSettings.themePreference,
    workspaceRespectGitIgnore:
      typeof settings.workspaceRespectGitIgnore === "boolean"
        ? settings.workspaceRespectGitIgnore
        : defaultAppSettings.workspaceRespectGitIgnore,
    workspaceShowHiddenFiles:
      typeof settings.workspaceShowHiddenFiles === "boolean"
        ? settings.workspaceShowHiddenFiles
        : defaultAppSettings.workspaceShowHiddenFiles
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function preserveCorruptJsonFile(filePath: string): Promise<void> {
  try {
    await rename(filePath, `${filePath}.corrupt-${Date.now()}`);
  } catch {
    // Recovery should still fall back to defaults if preserving the file fails.
  }
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
