import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ThemePreference } from "@pluma/ui";

import type { EditorViewMode } from "../../shared/shellState";

export type PersistedSessionState = {
  activeDocumentPath: string | null;
  documentPaths: string[];
  editorMode: EditorViewMode;
  paneSizes?: number[];
  workspacePath: string | null;
};

export type AppSettings = {
  themePreference: ThemePreference;
};

export const defaultAppSettings: AppSettings = {
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

  return parsedSettings;
}

export async function writeAppSettings(
  filePath: string,
  settings: AppSettings
): Promise<void> {
  await writeJsonFile(filePath, settings);
}

export async function readPersistedSessionState(
  filePath: string
): Promise<PersistedSessionState | null> {
  const parsedState = await readJsonFile(filePath);

  return isPersistedSessionState(parsedState) ? parsedState : null;
}

export async function writePersistedSessionState(
  filePath: string,
  state: PersistedSessionState
): Promise<void> {
  await writeJsonFile(filePath, state);
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
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

  return isThemePreference(candidate.themePreference);
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
    Array.isArray(candidate.documentPaths) &&
    candidate.documentPaths.every(
      (documentPath) => typeof documentPath === "string"
    ) &&
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
