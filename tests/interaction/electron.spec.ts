import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { markdownFixture } from "./markdownFixture";
import { documentSnapshot, hydrate, insertAt } from "./rendererHarness";

const require = createRequire(path.resolve("package.json"));

test("Electron context isolation, clean open, and real pointer insertion", async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), "pluma-interaction-"));
  const application = await electron.launch({
    executablePath: require("electron") as string,
    args: [path.resolve("tests/interaction/electronHarness.cjs")],
    env: {
      ...process.env,
      PLUMA_TEST_USER_DATA: userData,
      PLUMA_TEST_RENDERER_URL: "http://127.0.0.1:4179"
    }
  });
  try {
    const page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    expect(
      await application.evaluate(({ app }) => app.getPath("userData"))
    ).toBe(userData);
    const markdown = markdownFixture();
    await hydrate(page, markdown);
    expect(await documentSnapshot(page)).toEqual({
      rawText: markdown,
      saveState: "idle"
    });
    await insertAt(
      page,
      page
        .locator(".rich-editor .cm-draftly-table-cell")
        .filter({ hasText: /^Cell1$/ }),
      2,
      "ELECTRON"
    );
    expect(errors).toEqual([]);
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true });
  }
});
