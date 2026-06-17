import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ThemePreference } from "@pluma/ui";

import type { EditorViewMode } from "../../shared/shellState";

export type PersistedDocumentReference =
  | {
      kind: "app-draft";
      draftId: string;
      name: string;
    }
  | {
      kind: "desktop-path";
      path: string;
    };

export type PersistedSessionState = {
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

export type AppSettings = {
  autosaveEnabled: boolean;
  themePreference: ThemePreference;
};

export const defaultAppSettings: AppSettings = {
  autosaveEnabled: true,
  themePreference: "system"
};

export function isEditorViewMode(value: unknown): value is EditorViewMode {
  return value === "source" || value === "rich" || value === "split";
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export async function readAppSettings(filePath: string): Promise<AppSettings> {
  const parsedSettings = await readJsonFile(filePath);

  if (!isAppSettings(parsedSettings)) {
    return defaultAppSettings;
  }

  return {
    ...defaultAppSettings,
    ...parsedSettings
  };
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
    const activeWindow = value.windows[value.activeWindowIndex] ?? null;
    const windows = value.windows.filter(isMeaningfulPersistedWindowState);
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
    return isMeaningfulPersistedWindowState(value)
      ? {
          activeWindowIndex: 0,
          windows: [value]
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
    isThemePreference(candidate.themePreference)
  );
}

function isPersistedSessionState(
  value: unknown
): value is PersistedSessionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedSessionState>;

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
    isEditorViewMode(candidate.editorMode) &&
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
    return typeof candidate.path === "string";
  }

  if (candidate.kind === "app-draft") {
    return (
      typeof candidate.draftId === "string" &&
      typeof candidate.name === "string"
    );
  }

  return false;
}

function isPersistedMultiWindowSessionState(
  value: unknown
): value is PersistedMultiWindowSessionState {
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
