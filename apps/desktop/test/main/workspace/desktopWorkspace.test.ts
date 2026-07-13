import { describe, expect, it, vi } from "vitest";

import type {
  DesktopFileLocation,
  FileSystemAdapter,
  FileSystemEntry
} from "@pluma/core";

import {
  collectWorkspaceEntries,
  isPathInsideDirectory
} from "../../../src/main/workspace/desktopWorkspace";

describe("isPathInsideDirectory", () => {
  it("accepts nested names that begin with two dots", () => {
    expect(
      isPathInsideDirectory("/workspace", "/workspace/..notes/Entry.md")
    ).toBe(true);
  });

  it("rejects the directory itself and paths outside it", () => {
    expect(isPathInsideDirectory("/workspace", "/workspace")).toBe(false);
    expect(
      isPathInsideDirectory("/workspace", "/workspace-other/Entry.md")
    ).toBe(false);
    expect(isPathInsideDirectory("/workspace", "/outside/Entry.md")).toBe(
      false
    );
  });
});

function createFileSystem(
  entries: Record<string, FileSystemEntry<DesktopFileLocation>[]>,
  textFiles: Record<string, string | Error> = {}
): FileSystemAdapter<DesktopFileLocation> {
  return {
    getMetadata: () => Promise.resolve(null),
    listDirectory: (location) => Promise.resolve(entries[location.path] ?? []),
    readText: (location) => {
      const textFile = textFiles[location.path];

      if (textFile instanceof Error) {
        return Promise.reject(textFile);
      }

      return Promise.resolve(textFile ?? "");
    },
    writeTextAtomic: async (location) => ({
      kind: "success",
      location,
      metadata: {
        fileId: location.path,
        mtimeMs: 1,
        size: 1
      }
    })
  };
}

describe("collectWorkspaceEntries", () => {
  it("can hide dotfiles and dotfolders", async () => {
    const fileSystem = createFileSystem({
      "/workspace": [
        {
          kind: "file",
          location: { kind: "desktop-path", path: "/workspace/Notes.md" },
          name: "Notes.md"
        },
        {
          kind: "file",
          location: { kind: "desktop-path", path: "/workspace/.Hidden.md" },
          name: ".Hidden.md"
        },
        {
          kind: "directory",
          location: { kind: "desktop-path", path: "/workspace/.drafts" },
          name: ".drafts"
        }
      ],
      "/workspace/.drafts": [
        {
          kind: "file",
          location: { kind: "desktop-path", path: "/workspace/.drafts/A.md" },
          name: "A.md"
        }
      ]
    });

    await expect(
      collectWorkspaceEntries(fileSystem, "/workspace", 0, {
        showHiddenFiles: false
      })
    ).resolves.toEqual([
      {
        depth: 0,
        kind: "file",
        name: "Notes.md",
        path: "/workspace/Notes.md"
      }
    ]);
  });

  it("can filter entries with root and nested gitignore files", async () => {
    const fileSystem = createFileSystem(
      {
        "/workspace": [
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/.gitignore" },
            name: ".gitignore"
          },
          {
            kind: "directory",
            location: { kind: "desktop-path", path: "/workspace/keep" },
            name: "keep"
          },
          {
            kind: "directory",
            location: { kind: "desktop-path", path: "/workspace/node_modules" },
            name: "node_modules"
          },
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/Notes.md" },
            name: "Notes.md"
          },
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/skip.md" },
            name: "skip.md"
          }
        ],
        "/workspace/keep": [
          {
            kind: "file",
            location: {
              kind: "desktop-path",
              path: "/workspace/keep/.gitignore"
            },
            name: ".gitignore"
          },
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/keep/A.md" },
            name: "A.md"
          },
          {
            kind: "file",
            location: {
              kind: "desktop-path",
              path: "/workspace/keep/Draft.md"
            },
            name: "Draft.md"
          }
        ],
        "/workspace/node_modules": [
          {
            kind: "file",
            location: {
              kind: "desktop-path",
              path: "/workspace/node_modules/Package.md"
            },
            name: "Package.md"
          }
        ]
      },
      {
        "/workspace/.gitignore": "node_modules/\nskip.md\n",
        "/workspace/keep/.gitignore": "Draft.md\n"
      }
    );

    await expect(
      collectWorkspaceEntries(fileSystem, "/workspace", 0, {
        respectGitIgnore: true,
        showHiddenFiles: true
      })
    ).resolves.toEqual([
      {
        depth: 0,
        kind: "folder",
        name: "keep",
        path: "/workspace/keep"
      },
      {
        depth: 1,
        kind: "file",
        name: "A.md",
        path: "/workspace/keep/A.md"
      },
      {
        depth: 0,
        kind: "file",
        name: "Notes.md",
        path: "/workspace/Notes.md"
      }
    ]);
  });

  it("reads gitignore rules while hidden files are hidden", async () => {
    const fileSystem = createFileSystem(
      {
        "/workspace": [
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/.gitignore" },
            name: ".gitignore"
          },
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/Notes.md" },
            name: "Notes.md"
          },
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/ignored.md" },
            name: "ignored.md"
          }
        ]
      },
      {
        "/workspace/.gitignore": "ignored.md\n"
      }
    );

    await expect(
      collectWorkspaceEntries(fileSystem, "/workspace", 0, {
        respectGitIgnore: true,
        showHiddenFiles: false
      })
    ).resolves.toEqual([
      {
        depth: 0,
        kind: "file",
        name: "Notes.md",
        path: "/workspace/Notes.md"
      }
    ]);
  });

  it("hides git metadata when respecting gitignore even if hidden files show", async () => {
    const fileSystem = createFileSystem({
      "/workspace": [
        {
          kind: "directory",
          location: { kind: "desktop-path", path: "/workspace/.git" },
          name: ".git"
        },
        {
          kind: "file",
          location: { kind: "desktop-path", path: "/workspace/.Hidden.md" },
          name: ".Hidden.md"
        },
        {
          kind: "file",
          location: { kind: "desktop-path", path: "/workspace/Notes.md" },
          name: "Notes.md"
        }
      ],
      "/workspace/.git": [
        {
          kind: "file",
          location: { kind: "desktop-path", path: "/workspace/.git/HEAD.md" },
          name: "HEAD.md"
        }
      ]
    });

    await expect(
      collectWorkspaceEntries(fileSystem, "/workspace", 0, {
        respectGitIgnore: true,
        showHiddenFiles: true
      })
    ).resolves.toEqual([
      {
        depth: 0,
        kind: "file",
        name: ".Hidden.md",
        path: "/workspace/.Hidden.md"
      },
      {
        depth: 0,
        kind: "file",
        name: "Notes.md",
        path: "/workspace/Notes.md"
      }
    ]);
  });

  it("continues when gitignore cannot be read", async () => {
    const fileSystem = createFileSystem(
      {
        "/workspace": [
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/.gitignore" },
            name: ".gitignore"
          },
          {
            kind: "file",
            location: { kind: "desktop-path", path: "/workspace/Notes.md" },
            name: "Notes.md"
          }
        ]
      },
      {
        "/workspace/.gitignore": new Error("Permission denied")
      }
    );

    await expect(
      collectWorkspaceEntries(fileSystem, "/workspace", 0, {
        respectGitIgnore: true,
        showHiddenFiles: true
      })
    ).resolves.toEqual([
      {
        depth: 0,
        kind: "file",
        name: "Notes.md",
        path: "/workspace/Notes.md"
      }
    ]);
  });

  it("does not probe for gitignore files absent from directory listings", async () => {
    const readText = vi.fn(() => Promise.resolve("ignored.md\n"));
    const fileSystem = {
      ...createFileSystem({
        "/workspace": [
          {
            kind: "file" as const,
            location: {
              kind: "desktop-path" as const,
              path: "/workspace/Notes.md"
            },
            name: "Notes.md"
          }
        ]
      }),
      readText
    };

    await collectWorkspaceEntries(fileSystem, "/workspace", 0, {
      respectGitIgnore: true,
      showHiddenFiles: true
    });

    expect(readText).not.toHaveBeenCalled();
  });

  it("bounds concurrent directory reads while preserving entry order", async () => {
    let activeReads = 0;
    let maxActiveReads = 0;
    const directories = Array.from({ length: 20 }, (_, index) => ({
      kind: "directory" as const,
      location: {
        kind: "desktop-path" as const,
        path: `/workspace/folder-${index}`
      },
      name: `folder-${index}`
    }));
    const fileSystem = createFileSystem({
      "/workspace": directories,
      ...Object.fromEntries(
        directories.map((directory, index) => [
          directory.location.path,
          [
            {
              kind: "file" as const,
              location: {
                kind: "desktop-path" as const,
                path: `${directory.location.path}/Note-${index}.md`
              },
              name: `Note-${index}.md`
            }
          ]
        ])
      )
    });
    const listDirectory = fileSystem.listDirectory.bind(fileSystem);
    fileSystem.listDirectory = async (location) => {
      activeReads += 1;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeReads -= 1;
      return listDirectory(location);
    };

    const entries = await collectWorkspaceEntries(fileSystem, "/workspace", 0, {
      showHiddenFiles: true
    });

    expect(maxActiveReads).toBe(8);
    expect(entries[0]?.path).toBe("/workspace/folder-0");
    expect(entries.at(-1)?.path).toBe("/workspace/folder-19/Note-19.md");
  });
});
