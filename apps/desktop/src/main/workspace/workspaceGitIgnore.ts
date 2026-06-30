import path from "node:path";

import type { DesktopFileLocation, FileSystemAdapter } from "@pluma/core";

export type WorkspaceGitIgnoreRule = {
  anchored: boolean;
  basePath: string;
  directoryOnly: boolean;
  hasSlash: boolean;
  negative: boolean;
  regex: RegExp;
};

export type WorkspaceGitIgnoreEntry = {
  kind: "directory" | "file";
  name: string;
  path: string;
};

function toDesktopFileLocation(filePath: string): DesktopFileLocation {
  return {
    kind: "desktop-path",
    path: filePath
  };
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function gitIgnorePatternToRegExp(pattern: string): RegExp {
  let regex = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern.charAt(index);
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        regex += ".*";
        index += 1;
      } else {
        regex += "[^/]*";
      }
      continue;
    }

    if (character === "?") {
      regex += "[^/]";
      continue;
    }

    regex += escapeRegExp(character);
  }

  return new RegExp(`^${regex}$`);
}

function parseGitIgnoreRules(
  basePath: string,
  text: string
): WorkspaceGitIgnoreRule[] {
  const rules: WorkspaceGitIgnoreRule[] = [];

  for (const line of text.split(/\r?\n/)) {
    let pattern = line.trim();
    if (!pattern || pattern.startsWith("#")) {
      continue;
    }

    const negative = pattern.startsWith("!");
    if (negative) {
      pattern = pattern.slice(1).trim();
    }
    if (!pattern) {
      continue;
    }
    if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) {
      pattern = pattern.slice(1);
    }

    const directoryOnly = pattern.endsWith("/");
    if (directoryOnly) {
      pattern = pattern.slice(0, -1);
    }

    const anchored = pattern.startsWith("/");
    while (pattern.startsWith("/")) {
      pattern = pattern.slice(1);
    }
    if (!pattern) {
      continue;
    }

    rules.push({
      anchored,
      basePath,
      directoryOnly,
      hasSlash: pattern.includes("/"),
      negative,
      regex: gitIgnorePatternToRegExp(pattern)
    });
  }

  return rules;
}

async function readGitIgnoreRules(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  directoryPath: string
): Promise<WorkspaceGitIgnoreRule[]> {
  try {
    return parseGitIgnoreRules(
      directoryPath,
      await fileSystem.readText(
        toDesktopFileLocation(path.join(directoryPath, ".gitignore"))
      )
    );
  } catch {
    return [];
  }
}

function matchesGitIgnoreRule(
  rule: WorkspaceGitIgnoreRule,
  entry: WorkspaceGitIgnoreEntry
): boolean {
  const relativeFilePath = path.relative(rule.basePath, entry.path);

  if (relativeFilePath.startsWith("..") || path.isAbsolute(relativeFilePath)) {
    return false;
  }

  const relativePath = toPosixPath(relativeFilePath);

  if (!relativePath || (rule.directoryOnly && entry.kind !== "directory")) {
    return false;
  }

  if (rule.anchored || rule.hasSlash) {
    return rule.regex.test(relativePath);
  }

  return relativePath.split("/").some((part) => rule.regex.test(part));
}

export async function collectWorkspaceGitIgnoreRules(
  fileSystem: FileSystemAdapter<DesktopFileLocation>,
  directoryPath: string,
  inheritedRules: WorkspaceGitIgnoreRule[]
): Promise<WorkspaceGitIgnoreRule[]> {
  return inheritedRules.concat(
    await readGitIgnoreRules(fileSystem, directoryPath)
  );
}

export function isWorkspaceEntryGitIgnored(
  rules: WorkspaceGitIgnoreRule[],
  entry: WorkspaceGitIgnoreEntry
): boolean {
  if (entry.name === ".git") {
    return true;
  }

  let ignored = false;

  for (const rule of rules) {
    if (matchesGitIgnoreRule(rule, entry)) {
      ignored = !rule.negative;
    }
  }

  return ignored;
}
