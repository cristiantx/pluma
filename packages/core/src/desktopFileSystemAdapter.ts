import { randomUUID } from "node:crypto";
import {
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import type { DesktopFileLocation } from "./index.js";
import {
  getSaveConflictReason,
  isMetadataConflict,
  type FileMetadata,
  type FileSystemAdapter,
  type FileSystemEntry,
  type SaveResult,
  type WriteTextOptions
} from "./fileSystemAdapter.js";

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function toDesktopFileMetadata(
  fileStats: Awaited<ReturnType<typeof stat>>
): FileMetadata {
  return {
    fileId: `${fileStats.dev}:${fileStats.ino}`,
    mtimeMs: Number(fileStats.mtimeMs),
    size: Number(fileStats.size)
  };
}

async function readDesktopFileMetadata(
  location: DesktopFileLocation
): Promise<FileMetadata | null> {
  try {
    return toDesktopFileMetadata(await stat(location.path));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function compareFileSystemEntries(
  left: FileSystemEntry<DesktopFileLocation>,
  right: FileSystemEntry<DesktopFileLocation>
): number {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export class DesktopFileSystemAdapter implements FileSystemAdapter<DesktopFileLocation> {
  async getMetadata(
    location: DesktopFileLocation
  ): Promise<FileMetadata | null> {
    return readDesktopFileMetadata(location);
  }

  async listDirectory(
    location: DesktopFileLocation
  ): Promise<FileSystemEntry<DesktopFileLocation>[]> {
    const entries = await readdir(location.path, { withFileTypes: true });

    return entries
      .map<FileSystemEntry<DesktopFileLocation>>((entry) => ({
        kind: entry.isDirectory() ? "directory" : "file",
        location: {
          kind: "desktop-path" as const,
          path: path.join(location.path, entry.name)
        },
        name: entry.name
      }))
      .sort(compareFileSystemEntries);
  }

  async readText(location: DesktopFileLocation): Promise<string> {
    return readFile(location.path, "utf8");
  }

  async writeTextAtomic(
    location: DesktopFileLocation,
    text: string,
    options: WriteTextOptions = {}
  ): Promise<SaveResult<DesktopFileLocation>> {
    const currentMetadata = await readDesktopFileMetadata(location);

    if (isMetadataConflict(options.expectedMetadata, currentMetadata)) {
      return {
        actualMetadata: currentMetadata,
        expectedMetadata: options.expectedMetadata ?? null,
        kind: "conflict",
        location,
        reason: getSaveConflictReason(currentMetadata)
      };
    }

    const directoryPath = path.dirname(location.path);
    const baseName = path.basename(location.path);
    const tempPath = path.join(
      directoryPath,
      `.${baseName}.pluma-write-${randomUUID()}.tmp`
    );

    try {
      await writeFile(tempPath, text, "utf8");
      await rename(tempPath, location.path);

      const nextMetadata = await readDesktopFileMetadata(location);

      if (!nextMetadata) {
        return {
          code: "WRITE_VERIFY_FAILED",
          kind: "error",
          location,
          message: `Atomic write for "${location.path}" completed but metadata could not be read.`
        };
      }

      return {
        kind: "success",
        location,
        metadata: nextMetadata
      };
    } catch (error) {
      try {
        await unlink(tempPath);
      } catch (cleanupError) {
        if (!isNodeError(cleanupError) || cleanupError.code !== "ENOENT") {
          throw cleanupError;
        }
      }

      return {
        code:
          isNodeError(error) && typeof error.code === "string"
            ? error.code
            : "WRITE_FAILED",
        kind: "error",
        location,
        message:
          error instanceof Error
            ? error.message
            : `Unknown write failure for "${location.path}".`
      };
    }
  }
}
