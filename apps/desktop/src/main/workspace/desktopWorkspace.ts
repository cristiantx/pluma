import path from "node:path";

import {
  createDocumentSession,
  getMarkdownDocumentCapability,
  markdownPipeline,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import type { WorkspaceTreeEntry } from "../../shared/shellState";

const markdownExtensions = new Set([".md", ".markdown", ".mdown"]);

export function isMarkdownFilePath(filePath: string): boolean {
  return markdownExtensions.has(path.extname(filePath).toLowerCase());
}

export function isPathInsideDirectory(
  directoryPath: string,
  targetPath: string
): boolean {
  const relativePath = path.relative(directoryPath, targetPath);

  return (
    relativePath !== "" &&
    relativePath !== "." &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

export function toDesktopFileLocation(filePath: string): DesktopFileLocation {
  return {
    kind: "desktop-path",
    path: filePath
  };
}

export async function createSessionForFilePath(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  filePath: string
): Promise<DocumentSession | null> {
  const fileLocation = toDesktopFileLocation(filePath);
  const metadata = await fileSystem.getMetadata(fileLocation);

  if (!metadata) {
    return null;
  }

  const rawText = await fileSystem.readText(fileLocation);
  const analysis = markdownPipeline.analyze(markdownPipeline.parse(rawText));
  const capability = getMarkdownDocumentCapability(analysis);

  return createDocumentSession({
    capability,
    location: fileLocation,
    metadata,
    mode: capability === "rich-safe" ? "rich" : "source",
    rawText
  });
}

export async function tryCreateSessionForFilePath(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  filePath: string
): Promise<DocumentSession | null> {
  try {
    return await createSessionForFilePath(fileSystem, filePath);
  } catch {
    return null;
  }
}

export async function collectWorkspaceEntries(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  directoryPath: string,
  depth = 0
): Promise<WorkspaceTreeEntry[]> {
  const directoryEntries = await fileSystem.listDirectory(
    toDesktopFileLocation(directoryPath)
  );
  const workspaceEntries: WorkspaceTreeEntry[] = [];

  for (const directoryEntry of directoryEntries) {
    if (directoryEntry.kind === "directory") {
      const childEntries = await collectWorkspaceEntries(
        fileSystem,
        directoryEntry.location.path,
        depth + 1
      );

      if (childEntries.length === 0) {
        continue;
      }

      workspaceEntries.push({
        depth,
        kind: "folder",
        name: directoryEntry.name,
        path: directoryEntry.location.path
      });
      workspaceEntries.push(...childEntries);
      continue;
    }

    if (!isMarkdownFilePath(directoryEntry.location.path)) {
      continue;
    }

    workspaceEntries.push({
      depth,
      kind: "file",
      name: directoryEntry.name,
      path: directoryEntry.location.path
    });
  }

  return workspaceEntries;
}

export async function tryCollectWorkspaceEntries(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  directoryPath: string | null
): Promise<WorkspaceTreeEntry[]> {
  if (!directoryPath) {
    return [];
  }

  try {
    return await collectWorkspaceEntries(fileSystem, directoryPath);
  } catch {
    return [];
  }
}
