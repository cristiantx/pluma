import { describe, expect, it } from "vitest";

import type {
  DesktopFileLocation,
  FileSystemAdapter,
  FileSystemEntry
} from "@pluma/core";

import { collectWorkspaceEntries } from "../../../src/main/workspace/desktopWorkspace";

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
});
