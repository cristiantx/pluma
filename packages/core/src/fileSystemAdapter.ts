import type { FileLocation } from "./index.js";

export type FileMetadata = {
  fileId: string | null;
  mtimeMs: number;
  size: number;
};

export type FileSystemEntry<TLocation extends FileLocation = FileLocation> = {
  kind: "directory" | "file";
  location: TLocation;
  name: string;
};

export type SaveConflictReason = "deleted" | "modified";

export type SaveSuccessResult<TLocation extends FileLocation = FileLocation> = {
  kind: "success";
  location: TLocation;
  metadata: FileMetadata;
};

export type SaveConflictResult<TLocation extends FileLocation = FileLocation> =
  {
    actualMetadata: FileMetadata | null;
    expectedMetadata: FileMetadata | null;
    kind: "conflict";
    location: TLocation;
    reason: SaveConflictReason;
  };

export type SaveErrorResult<TLocation extends FileLocation = FileLocation> = {
  code: string;
  kind: "error";
  location: TLocation;
  message: string;
};

export type SaveResult<TLocation extends FileLocation = FileLocation> =
  | SaveSuccessResult<TLocation>
  | SaveConflictResult<TLocation>
  | SaveErrorResult<TLocation>;

export type WriteTextOptions = {
  expectedMetadata?: FileMetadata | null;
};

export interface FileSystemAdapter<
  TLocation extends FileLocation = FileLocation
> {
  getMetadata(location: TLocation): Promise<FileMetadata | null>;
  listDirectory(location: TLocation): Promise<FileSystemEntry<TLocation>[]>;
  readText(location: TLocation): Promise<string>;
  writeTextAtomic(
    location: TLocation,
    text: string,
    options?: WriteTextOptions
  ): Promise<SaveResult<TLocation>>;
}

export function isMetadataConflict(
  expectedMetadata: FileMetadata | null | undefined,
  actualMetadata: FileMetadata | null
): boolean {
  if (!expectedMetadata) {
    return false;
  }

  if (!actualMetadata) {
    return true;
  }

  if (
    expectedMetadata.fileId !== null &&
    actualMetadata.fileId !== null &&
    expectedMetadata.fileId !== actualMetadata.fileId
  ) {
    return true;
  }

  return (
    expectedMetadata.mtimeMs !== actualMetadata.mtimeMs ||
    expectedMetadata.size !== actualMetadata.size
  );
}

export function getSaveConflictReason(
  actualMetadata: FileMetadata | null
): SaveConflictReason {
  return actualMetadata ? "modified" : "deleted";
}
