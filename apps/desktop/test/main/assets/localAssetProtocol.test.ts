import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { isLocalAssetPathAuthorized } from "../../../src/main/assets/localAssetProtocol";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directoryPath) =>
        rm(directoryPath, { force: true, recursive: true })
      )
  );
});

async function createFixture(): Promise<{
  allowedFile: string;
  allowedRoot: string;
  directoryPath: string;
  outsideFile: string;
  symlinkPath: string;
}> {
  const directoryPath = await mkdtemp(path.join(tmpdir(), "pluma-assets-"));
  temporaryDirectories.push(directoryPath);
  const allowedRoot = path.join(directoryPath, "workspace");
  const outsideRoot = path.join(directoryPath, "outside");
  const allowedFile = path.join(allowedRoot, "allowed.png");
  const outsideFile = path.join(outsideRoot, "private.png");
  const symlinkPath = path.join(allowedRoot, "linked.png");

  await mkdir(allowedRoot);
  await mkdir(outsideRoot);
  await writeFile(allowedFile, "allowed");
  await writeFile(outsideFile, "private");
  await symlink(outsideFile, symlinkPath);

  return {
    allowedFile,
    allowedRoot,
    directoryPath,
    outsideFile,
    symlinkPath
  };
}

describe("isLocalAssetPathAuthorized", () => {
  it("allows files within an authorized root", async () => {
    const fixture = await createFixture();

    await expect(
      isLocalAssetPathAuthorized(fixture.allowedFile, [fixture.allowedRoot])
    ).resolves.toBe(true);
  });

  it("rejects outside files, directories, and symlink escapes", async () => {
    const fixture = await createFixture();

    await expect(
      isLocalAssetPathAuthorized(fixture.outsideFile, [fixture.allowedRoot])
    ).resolves.toBe(false);
    await expect(
      isLocalAssetPathAuthorized(fixture.directoryPath, [fixture.allowedRoot])
    ).resolves.toBe(false);
    await expect(
      isLocalAssetPathAuthorized(fixture.symlinkPath, [fixture.allowedRoot])
    ).resolves.toBe(false);
  });
});
