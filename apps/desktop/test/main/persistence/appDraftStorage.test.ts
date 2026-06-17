import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAppDraftStorage } from "../../../src/main/persistence/appDraftStorage";

describe("createAppDraftStorage", () => {
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "pluma-drafts-"));
  });

  afterEach(async () => {
    await rm(tempDirectory, { force: true, recursive: true });
  });

  it("creates, updates, reads, and deletes app draft files", async () => {
    const storage = createAppDraftStorage(tempDirectory);
    const location = await storage.createDraft("Untitled-1", "# Untitled\n");

    expect(location).toMatchObject({
      kind: "app-draft",
      name: "Untitled-1"
    });
    expect(await storage.readDraft(location)).toBe("# Untitled\n");

    await storage.writeDraft(location, "# Edited\n");
    expect(await storage.readDraft(location)).toBe("# Edited\n");

    await storage.deleteDraft(location);
    expect(await storage.readDraft(location)).toBeNull();
  });
});
