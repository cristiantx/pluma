import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AppDraftFileLocation } from "@pluma/core";

export type AppDraftStorage = {
  createDraft: (name: string, rawText: string) => Promise<AppDraftFileLocation>;
  deleteDraft: (location: AppDraftFileLocation) => Promise<void>;
  readDraft: (location: AppDraftFileLocation) => Promise<string | null>;
  writeDraft: (
    location: AppDraftFileLocation,
    rawText: string
  ) => Promise<void>;
};

export function createAppDraftStorage(
  draftsDirectory: string
): AppDraftStorage {
  function getDraftPath(location: AppDraftFileLocation): string {
    return path.join(draftsDirectory, `${location.draftId}.md`);
  }

  async function createDraft(
    name: string,
    rawText: string
  ): Promise<AppDraftFileLocation> {
    const location: AppDraftFileLocation = {
      draftId: randomUUID(),
      kind: "app-draft",
      name
    };

    await writeDraft(location, rawText);

    return location;
  }

  async function readDraft(
    location: AppDraftFileLocation
  ): Promise<string | null> {
    try {
      return await readFile(getDraftPath(location), "utf8");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }

      throw error;
    }
  }

  async function writeDraft(
    location: AppDraftFileLocation,
    rawText: string
  ): Promise<void> {
    await mkdir(draftsDirectory, { recursive: true });
    await writeFile(getDraftPath(location), rawText, "utf8");
  }

  async function deleteDraft(location: AppDraftFileLocation): Promise<void> {
    await rm(getDraftPath(location), { force: true });
  }

  return {
    createDraft,
    deleteDraft,
    readDraft,
    writeDraft
  };
}
