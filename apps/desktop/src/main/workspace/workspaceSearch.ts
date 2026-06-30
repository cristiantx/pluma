import { spawn } from "node:child_process";
import path from "node:path";

import type {
  WorkspaceSearchMatch,
  WorkspaceSearchOptions as SharedWorkspaceSearchOptions
} from "../../shared/shellState";
import { isPathInsideDirectory } from "./desktopWorkspace";
import { resolveRipgrepPath } from "./ripgrepPath";

type RipgrepMatch = {
  type: "match";
  data: {
    lines: { text: string };
    line_number: number;
    path: { text: string };
    submatches: Array<{
      end: number;
      match: { text: string };
      start: number;
    }>;
  };
};

type WorkspaceSearchModifiers = SharedWorkspaceSearchOptions & {
  respectGitIgnore?: boolean;
};

export type WorkspaceSearchOptions = {
  folderPath?: string | null;
  options: WorkspaceSearchModifiers;
  query: string;
  workspacePath: string;
};

export async function searchMarkdownWorkspace(
  options: WorkspaceSearchOptions
): Promise<WorkspaceSearchMatch[]> {
  const query = options.query.trim();

  if (!query) {
    return [];
  }

  const searchRoot = getSearchRoot(options);

  if (!searchRoot) {
    return [];
  }

  const output = await runRipgrep(query, searchRoot, options.options);

  return output
    .split("\n")
    .flatMap((line) => parseRipgrepLine(line))
    .slice(0, 200);
}

function getSearchRoot(options: WorkspaceSearchOptions): string | null {
  if (!options.folderPath) {
    return options.workspacePath;
  }

  return isPathInsideDirectory(options.workspacePath, options.folderPath) ||
    options.workspacePath === options.folderPath
    ? options.folderPath
    : null;
}

async function runRipgrep(
  query: string,
  searchRoot: string,
  options: WorkspaceSearchModifiers
): Promise<string> {
  const ripgrepPath = await resolveRipgrepPath();
  const args = createRipgrepArgs(query, searchRoot, options);

  return new Promise((resolve, reject) => {
    const child = spawn(ripgrepPath, args, {
      cwd: path.dirname(searchRoot)
    });
    const output: string[] = [];
    const errors: string[] = [];

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => output.push(chunk));
    child.stderr.on("data", (chunk: string) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || code === 1) {
        resolve(output.join(""));
        return;
      }

      reject(new Error(errors.join("").trim() || "Workspace search failed."));
    });
  });
}

export function createRipgrepArgs(
  query: string,
  searchRoot: string,
  options: WorkspaceSearchModifiers
): string[] {
  const args = [
    "--no-config",
    "--json",
    "--line-number",
    "--glob",
    "*.md",
    "--glob",
    "*.markdown",
    "--glob",
    "*.mdown"
  ];

  if (options.respectGitIgnore) {
    args.push("--no-require-git");
  } else {
    args.push("--no-ignore");
  }

  if (options.caseSensitive) {
    args.push("--case-sensitive");
  } else {
    args.push("--ignore-case");
  }

  if (!options.regexp) {
    args.push("--fixed-strings");
  }

  if (options.wholeWord) {
    args.push("--word-regexp");
  }

  args.push("--", query, searchRoot);

  return args;
}

export function parseRipgrepLine(line: string): WorkspaceSearchMatch[] {
  if (!line) {
    return [];
  }

  const event = parseRipgrepEvent(line);

  if (!event || !isRipgrepMatch(event)) {
    return [];
  }

  const lineText = event.data.lines.text.replace(/\r?\n$/, "");
  return event.data.submatches.map((submatch) => ({
    filePath: event.data.path.text,
    line: event.data.line_number,
    lineText,
    matchEnd: byteOffsetToStringIndex(lineText, submatch.end),
    matchStart: byteOffsetToStringIndex(lineText, submatch.start),
    preview: lineText.trim()
  }));
}

function byteOffsetToStringIndex(value: string, byteOffset: number): number {
  let bytesSeen = 0;
  let stringIndex = 0;

  for (const character of value) {
    const nextBytesSeen = bytesSeen + Buffer.byteLength(character);

    if (nextBytesSeen > byteOffset) {
      return stringIndex;
    }

    bytesSeen = nextBytesSeen;
    stringIndex += character.length;
  }

  return stringIndex;
}

function parseRipgrepEvent(
  line: string
): RipgrepMatch | { type: string } | null {
  try {
    return JSON.parse(line) as RipgrepMatch | { type: string };
  } catch {
    return null;
  }
}

function isRipgrepMatch(
  event: RipgrepMatch | { type: string }
): event is RipgrepMatch {
  return event.type === "match";
}
