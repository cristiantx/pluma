import path from "node:path";

import {
  createDocumentSession,
  isMarkdownFilePath,
  type DocumentModeConstraint,
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
import { AsyncConcurrencyLimiter } from "../runtime/asyncConcurrency";

const workspaceScanConcurrency = 8;

export type MarkdownModeAnalyzer = (
  rawText: string
) => Promise<DocumentModeConstraint>;

export function isPathInsideDirectory(
  directoryPath: string,
  targetPath: string
): boolean {
  const relativePath = path.relative(directoryPath, targetPath);

  return (
    relativePath !== "" &&
    relativePath !== "." &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
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
  filePath: string,
  analyzeMarkdownMode: MarkdownModeAnalyzer
): Promise<DocumentSession | null> {
  const fileLocation = toDesktopFileLocation(filePath);
  const metadata = await fileSystem.getMetadata(fileLocation);

  if (!metadata) {
    return null;
  }

  const rawText = await fileSystem.readText(fileLocation);
  const modeConstraint = await analyzeMarkdownMode(rawText);

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
  filePath: string,
  analyzeMarkdownMode: MarkdownModeAnalyzer
): Promise<DocumentSession | null> {
  try {
    return await createSessionForFilePath(
      fileSystem,
      filePath,
      analyzeMarkdownMode
    );
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
  const limiter = new AsyncConcurrencyLimiter(workspaceScanConcurrency);
  return collectWorkspaceEntriesForDirectory(
    fileSystem,
    directoryPath,
    depth,
    options,
    [],
    limiter
  );
}

async function collectWorkspaceEntriesForDirectory(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  directoryPath: string,
  depth: number,
  options: CollectWorkspaceEntriesOptions,
  inheritedGitIgnoreRules: WorkspaceGitIgnoreRule[],
  limiter: AsyncConcurrencyLimiter
): Promise<WorkspaceTreeEntry[]> {
  const directoryEntries = await limiter.run(() =>
    fileSystem.listDirectory(toDesktopFileLocation(directoryPath))
  );
  const workspaceEntries: WorkspaceTreeEntry[] = [];
  const gitIgnoreRules = options.respectGitIgnore
    ? await limiter.run(() =>
        collectWorkspaceGitIgnoreRules(
          fileSystem,
          directoryPath,
          inheritedGitIgnoreRules,
          directoryEntries.some(
            (entry) => entry.kind === "file" && entry.name === ".gitignore"
          )
        )
      )
    : inheritedGitIgnoreRules;

  const entryGroups = await Promise.all(
    directoryEntries.map(async (directoryEntry) => {
      if (
        options.respectGitIgnore &&
        isWorkspaceEntryGitIgnored(gitIgnoreRules, {
          kind: directoryEntry.kind,
          name: directoryEntry.name,
          path: directoryEntry.location.path
        })
      ) {
        return [];
      }

      if (!options.showHiddenFiles && directoryEntry.name.startsWith(".")) {
        return [];
      }

      if (directoryEntry.kind === "directory") {
        const childEntries = await collectWorkspaceEntriesForDirectory(
          fileSystem,
          directoryEntry.location.path,
          depth + 1,
          options,
          gitIgnoreRules,
          limiter
        );

        return [
          {
            depth,
            kind: "folder" as const,
            name: directoryEntry.name,
            path: directoryEntry.location.path
          },
          ...childEntries
        ];
      }

      if (!isMarkdownFilePath(directoryEntry.location.path)) {
        return [];
      }

      return [
        {
          depth,
          kind: "file" as const,
          name: directoryEntry.name,
          path: directoryEntry.location.path
        }
      ];
    })
  );

  for (const entryGroup of entryGroups) {
    workspaceEntries.push(...entryGroup);
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
