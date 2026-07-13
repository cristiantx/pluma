import { randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import type { AppDraftFileLocation, FileMetadata } from "@pluma/core";

import { writeTextFileAtomic } from "./atomicFile";

export type AppDraftStorage = {
  createDraft: (name: string, rawText: string) => Promise<AppDraftFileLocation>;
  deleteDraft: (location: AppDraftFileLocation) => Promise<void>;
  readDraft: (location: AppDraftFileLocation) => Promise<string | null>;
  writeDraft: (
    location: AppDraftFileLocation,
    rawText: string
  ) => Promise<FileMetadata>;
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
  ): Promise<FileMetadata> {
    const draftPath = getDraftPath(location);
    await writeTextFileAtomic(draftPath, rawText);
    const metadata = await stat(draftPath);

    return {
      fileId: `${metadata.dev}:${metadata.ino}`,
      mtimeMs: Number(metadata.mtimeMs),
      size: Number(metadata.size)
    };
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
