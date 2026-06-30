import path from "node:path";

import {
  createDocumentSession,
  getMarkdownDocumentModeConstraint,
  markdownPipeline,
  type DesktopFileLocation,
  type DocumentSession,
  type FileSystemAdapter
} from "@pluma/core";

import type { WorkspaceTreeEntry } from "../../shared/shellState";
import {
  collectWorkspaceGitIgnoreRules,
  isWorkspaceEntryGitIgnored,
  type WorkspaceGitIgnoreRule
} from "./workspaceGitIgnore";

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

function toDesktopFileLocation(filePath: string): DesktopFileLocation {
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
  const modeConstraint = getMarkdownDocumentModeConstraint(analysis);

  return createDocumentSession({
    location: fileLocation,
    metadata,
    mode: modeConstraint === "source-only" ? "source" : "rich",
    modeConstraint,
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

export type CollectWorkspaceEntriesOptions = {
  respectGitIgnore?: boolean;
  showHiddenFiles: boolean;
};

export async function collectWorkspaceEntries(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  directoryPath: string,
  depth = 0,
  options: CollectWorkspaceEntriesOptions = { showHiddenFiles: true }
): Promise<WorkspaceTreeEntry[]> {
  return collectWorkspaceEntriesForDirectory(
    fileSystem,
    directoryPath,
    depth,
    options
  );
}

async function collectWorkspaceEntriesForDirectory(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  directoryPath: string,
  depth: number,
  options: CollectWorkspaceEntriesOptions,
  inheritedGitIgnoreRules: WorkspaceGitIgnoreRule[] = []
): Promise<WorkspaceTreeEntry[]> {
  const directoryEntries = await fileSystem.listDirectory(
    toDesktopFileLocation(directoryPath)
  );
  const workspaceEntries: WorkspaceTreeEntry[] = [];
  const gitIgnoreRules = options.respectGitIgnore
    ? await collectWorkspaceGitIgnoreRules(
        fileSystem,
        directoryPath,
        inheritedGitIgnoreRules
      )
    : inheritedGitIgnoreRules;

  for (const directoryEntry of directoryEntries) {
    if (
      options.respectGitIgnore &&
      isWorkspaceEntryGitIgnored(gitIgnoreRules, {
        kind: directoryEntry.kind,
        name: directoryEntry.name,
        path: directoryEntry.location.path
      })
    ) {
      continue;
    }

    if (!options.showHiddenFiles && directoryEntry.name.startsWith(".")) {
      continue;
    }

    if (directoryEntry.kind === "directory") {
      const childEntries = await collectWorkspaceEntriesForDirectory(
        fileSystem,
        directoryEntry.location.path,
        depth + 1,
        options,
        gitIgnoreRules
      );

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
  directoryPath: string | null,
  options: CollectWorkspaceEntriesOptions = { showHiddenFiles: true }
): Promise<WorkspaceTreeEntry[]> {
  if (!directoryPath) {
    return [];
  }

  try {
    return await collectWorkspaceEntries(fileSystem, directoryPath, 0, options);
  } catch {
    return [];
  }
}
