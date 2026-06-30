import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRipgrepArgs,
  parseRipgrepLine,
  searchMarkdownWorkspace
} from "../../../src/main/workspace/workspaceSearch";

describe("createRipgrepArgs", () => {
  it("uses fixed-string case-insensitive search by default", () => {
    expect(
      createRipgrepArgs("already", "/tmp/pluma", {
        caseSensitive: false,
        regexp: false,
        wholeWord: false
      })
    ).toContain("--ignore-case");
    expect(
      createRipgrepArgs("already", "/tmp/pluma", {
        caseSensitive: false,
        regexp: false,
        wholeWord: false
      })
    ).toContain("--no-config");
    expect(
      createRipgrepArgs("already", "/tmp/pluma", {
        caseSensitive: false,
        regexp: false,
        wholeWord: false
      })
    ).toContain("--fixed-strings");
  });

  it("searches ignored files when gitignore respect is disabled", () => {
    const args = createRipgrepArgs("already", "/tmp/pluma", {
      caseSensitive: false,
      regexp: false,
      respectGitIgnore: false,
      wholeWord: false
    });

    expect(args).toContain("--no-ignore");
    expect(args).not.toContain("--no-require-git");
  });

  it("respects gitignore files outside Git repositories when requested", () => {
    const args = createRipgrepArgs("already", "/tmp/pluma", {
      caseSensitive: false,
      regexp: false,
      respectGitIgnore: true,
      wholeWord: false
    });

    expect(args).toContain("--no-require-git");
    expect(args).not.toContain("--no-ignore");
  });

  it("adds case-sensitive, regex, and word flags only when requested", () => {
    const args = createRipgrepArgs("already", "/tmp/pluma", {
      caseSensitive: true,
      regexp: true,
      wholeWord: true
    });

    expect(args).toContain("--case-sensitive");
    expect(args).not.toContain("--ignore-case");
    expect(args).not.toContain("--fixed-strings");
    expect(args).toContain("--word-regexp");
  });

  it("keeps regex disabled unless regex search is requested", () => {
    expect(
      createRipgrepArgs("a.c", "/tmp/pluma", {
        caseSensitive: false,
        regexp: false,
        wholeWord: false
      })
    ).toContain("--fixed-strings");

    expect(
      createRipgrepArgs("a.c", "/tmp/pluma", {
        caseSensitive: false,
        regexp: true,
        wholeWord: false
      })
    ).not.toContain("--fixed-strings");
  });
});

describe("parseRipgrepLine", () => {
  it("returns every submatch from a matching line", () => {
    const matches = parseRipgrepLine(
      JSON.stringify({
        type: "match",
        data: {
          line_number: 7,
          lines: {
            text: "already Already already\n"
          },
          path: {
            text: "/tmp/pluma/Notes.md"
          },
          submatches: [
            {
              start: 0,
              end: 7,
              match: {
                text: "already"
              }
            },
            {
              start: 8,
              end: 15,
              match: {
                text: "Already"
              }
            },
            {
              start: 16,
              end: 23,
              match: {
                text: "already"
              }
            }
          ]
        }
      })
    );

    expect(matches).toEqual([
      {
        filePath: "/tmp/pluma/Notes.md",
        line: 7,
        lineText: "already Already already",
        matchEnd: 7,
        matchStart: 0,
        preview: "already Already already"
      },
      {
        filePath: "/tmp/pluma/Notes.md",
        line: 7,
        lineText: "already Already already",
        matchEnd: 15,
        matchStart: 8,
        preview: "already Already already"
      },
      {
        filePath: "/tmp/pluma/Notes.md",
        line: 7,
        lineText: "already Already already",
        matchEnd: 23,
        matchStart: 16,
        preview: "already Already already"
      }
    ]);
  });
});

describe("searchMarkdownWorkspace", () => {
  it("applies case, regex, and whole-word search modifiers", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "pluma-search-"));

    try {
      await writeFile(
        path.join(workspacePath, "Notes.md"),
        [
          "already",
          "Already",
          "alreadyish",
          "abc",
          "axc",
          "a.c",
          "foo",
          "foo_bar"
        ].join("\n")
      );

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: false,
            regexp: false,
            wholeWord: false
          },
          query: "already",
          workspacePath
        })
      ).resolves.toHaveLength(3);

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: true,
            regexp: false,
            wholeWord: false
          },
          query: "already",
          workspacePath
        })
      ).resolves.toHaveLength(2);

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: false,
            regexp: false,
            wholeWord: true
          },
          query: "already",
          workspacePath
        })
      ).resolves.toHaveLength(2);

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: false,
            regexp: true,
            wholeWord: false
          },
          query: "a.c",
          workspacePath
        })
      ).resolves.toHaveLength(3);

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: false,
            regexp: false,
            wholeWord: false
          },
          query: "a.c",
          workspacePath
        })
      ).resolves.toHaveLength(1);
    } finally {
      await rm(workspacePath, { force: true, recursive: true });
    }
  });

  it("matches lowercase text when the query is uppercase and case sensitivity is off", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "pluma-search-"));

    try {
      await writeFile(path.join(workspacePath, "Browser.md"), "browser\n");

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: false,
            regexp: false,
            wholeWord: false
          },
          query: "Browser",
          workspacePath
        })
      ).resolves.toMatchObject([
        {
          lineText: "browser",
          matchEnd: 7,
          matchStart: 0
        }
      ]);
    } finally {
      await rm(workspacePath, { force: true, recursive: true });
    }
  });

  it("can opt into respecting gitignore files in non-Git folders", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "pluma-search-"));

    try {
      await writeFile(path.join(workspacePath, ".gitignore"), "ignored/\n");
      await mkdir(path.join(workspacePath, "ignored"));
      await writeFile(
        path.join(workspacePath, "ignored", "Hidden.md"),
        "needle\n"
      );
      await writeFile(path.join(workspacePath, "Visible.md"), "needle\n");

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: false,
            regexp: false,
            respectGitIgnore: false,
            wholeWord: false
          },
          query: "needle",
          workspacePath
        })
      ).resolves.toHaveLength(2);

      await expect(
        searchMarkdownWorkspace({
          folderPath: null,
          options: {
            caseSensitive: false,
            regexp: false,
            respectGitIgnore: true,
            wholeWord: false
          },
          query: "needle",
          workspacePath
        })
      ).resolves.toMatchObject([
        {
          filePath: path.join(workspacePath, "Visible.md")
        }
      ]);
    } finally {
      await rm(workspacePath, { force: true, recursive: true });
    }
  });
});
