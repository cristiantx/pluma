import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DesktopFileLocation } from "../src/index.js";
import { DesktopFileSystemAdapter } from "../src/desktop.js";

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

describe("DesktopFileSystemAdapter", () => {
  let tempDirectoryPath = "";
  let adapter: DesktopFileSystemAdapter;

  beforeEach(async () => {
    tempDirectoryPath = await mkdtemp(path.join(os.tmpdir(), "pluma-core-"));
    adapter = new DesktopFileSystemAdapter();
  });

  afterEach(async () => {
    if (tempDirectoryPath) {
      await rm(tempDirectoryPath, { force: true, recursive: true });
    }
  });

  it("reads, stats, and lists desktop files", async () => {
    const notesPath = path.join(tempDirectoryPath, "Notes.md");
    const draftsPath = path.join(tempDirectoryPath, "Drafts");

    await mkdir(draftsPath);
    await writeFile(notesPath, "# Notes\n", "utf8");
    await writeFile(path.join(draftsPath, "Outline.md"), "outline", "utf8");

    expect(await adapter.readText(desktopLocation(notesPath))).toBe(
      "# Notes\n"
    );

    const metadata = await adapter.getMetadata(desktopLocation(notesPath));
    expect(metadata?.size).toBe("# Notes\n".length);

    const entries = await adapter.listDirectory(
      desktopLocation(tempDirectoryPath)
    );
    expect(entries.map((entry) => `${entry.kind}:${entry.name}`)).toEqual([
      "directory:Drafts",
      "file:Notes.md"
    ]);
  });

  it("lists directories before files in name order", async () => {
    const alphaDirPath = path.join(tempDirectoryPath, "Alpha");
    const zetaFilePath = path.join(tempDirectoryPath, "Zeta.md");
    const betaFilePath = path.join(tempDirectoryPath, "beta.md");

    await mkdir(alphaDirPath);
    await writeFile(zetaFilePath, "zeta", "utf8");
    await writeFile(betaFilePath, "beta", "utf8");

    const entries = await adapter.listDirectory(
      desktopLocation(tempDirectoryPath)
    );
    expect(entries.map((entry) => `${entry.kind}:${entry.name}`)).toEqual([
      "directory:Alpha",
      "file:beta.md",
      "file:Zeta.md"
    ]);
  });

  it("writes text atomically and returns fresh metadata", async () => {
    const location = desktopLocation(path.join(tempDirectoryPath, "Draft.md"));
    const result = await adapter.writeTextAtomic(location, "# Draft\n");

    expect(result.kind).toBe("success");
    expect(await adapter.readText(location)).toBe("# Draft\n");

    const directoryEntries = await adapter.listDirectory(
      desktopLocation(tempDirectoryPath)
    );

    expect(
      directoryEntries.some((entry) => entry.name.includes(".pluma-write-"))
    ).toBe(false);
  });

  it("detects metadata conflicts before overwriting a file", async () => {
    const location = desktopLocation(
      path.join(tempDirectoryPath, "Conflict.md")
    );

    await writeFile(location.path, "first", "utf8");
    const metadata = await adapter.getMetadata(location);

    expect(metadata).not.toBeNull();

    await sleep(15);
    await writeFile(location.path, "external", "utf8");

    const result = await adapter.writeTextAtomic(location, "mine", {
      expectedMetadata: metadata
    });

    expect(result.kind).toBe("conflict");
    expect(result.reason).toBe("modified");
    expect(await readFile(location.path, "utf8")).toBe("external");
  });

  it("detects deleted-file conflicts before rewriting a missing file", async () => {
    const location = desktopLocation(
      path.join(tempDirectoryPath, "Deleted.md")
    );

    await writeFile(location.path, "before delete", "utf8");
    const metadata = await adapter.getMetadata(location);

    expect(metadata).not.toBeNull();

    await unlink(location.path);

    const result = await adapter.writeTextAtomic(location, "rewrite", {
      expectedMetadata: metadata
    });

    expect(result.kind).toBe("conflict");
    expect(result.reason).toBe("deleted");
  });
});

function desktopLocation(pathname: string): DesktopFileLocation {
  return {
    kind: "desktop-path",
    path: pathname
  };
}
