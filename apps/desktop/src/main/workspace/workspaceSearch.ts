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
  signal?: AbortSignal;
  workspacePath: string;
};

const maximumWorkspaceSearchMatches = 200;

export class WorkspaceSearchController {
  private abortController: AbortController | null = null;

  dispose(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async search(
    options: Omit<WorkspaceSearchOptions, "signal">
  ): Promise<WorkspaceSearchMatch[]> {
    this.abortController?.abort();
    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      return await searchMarkdownWorkspace({
        ...options,
        signal: abortController.signal
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return [];
      }

      throw error;
    } finally {
      if (this.abortController === abortController) {
        this.abortController = null;
      }
    }
  }
}

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

  return runRipgrep(query, searchRoot, options.options, options.signal);
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
  options: WorkspaceSearchModifiers,
  signal?: AbortSignal
): Promise<WorkspaceSearchMatch[]> {
  const ripgrepPath = await resolveRipgrepPath();
  const args = createRipgrepArgs(query, searchRoot, options);

  return new Promise((resolve, reject) => {
    const child = spawn(ripgrepPath, args, {
      cwd: path.dirname(searchRoot)
    });
    const matches: WorkspaceSearchMatch[] = [];
    const errors: string[] = [];
    let bufferedOutput = "";
    let didReachLimit = false;
    let isSettled = false;

    const settle = (callback: () => void, removeAbortListener = true): void => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      if (removeAbortListener) {
        signal?.removeEventListener("abort", handleAbort);
      }
      callback();
    };

    const collectLine = (line: string): void => {
      if (!line || didReachLimit) {
        return;
      }

      const remainingCount = maximumWorkspaceSearchMatches - matches.length;
      matches.push(...parseRipgrepLine(line).slice(0, remainingCount));

      if (matches.length >= maximumWorkspaceSearchMatches) {
        didReachLimit = true;
        child.kill();
      }
    };

    const handleAbort = (): void => {
      child.kill();
      settle(() => resolve([]), false);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      bufferedOutput += chunk;
      const lines = bufferedOutput.split("\n");
      bufferedOutput = lines.pop() ?? "";
      lines.forEach(collectLine);
    });
    child.stderr.on("data", (chunk: string) => errors.push(chunk));
    child.on("error", (error) => settle(() => reject(error)));
    child.on("close", (code) => {
      collectLine(bufferedOutput);

      if (code === 0 || code === 1 || didReachLimit || signal?.aborted) {
        settle(() => resolve(signal?.aborted ? [] : matches));
        return;
      }

      settle(() =>
        reject(new Error(errors.join("").trim() || "Workspace search failed."))
      );
    });

    if (signal?.aborted) {
      handleAbort();
    } else {
      signal?.addEventListener("abort", handleAbort, { once: true });
    }
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
