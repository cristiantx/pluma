import { describe, expect, it } from "vitest";

import type {
  DesktopFileLocation,
  FileSystemAdapter,
  FileSystemEntry
} from "@pluma/core";

import { collectWorkspaceEntries } from "../../../src/main/workspace/desktopWorkspace";

function createFileSystem(
  entries: Record<string, FileSystemEntry<DesktopFileLocation>[]>
): FileSystemAdapter<DesktopFileLocation> {
  return {
    getMetadata: () => Promise.resolve(null),
    listDirectory: (location) => Promise.resolve(entries[location.path] ?? []),
    readText: () => Promise.resolve(""),
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
});
