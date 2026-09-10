import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  clickApplicationMenuItem,
  forceCloseProduction,
  launchProduction,
  quitProductionGracefully,
  runRendererCommand,
  setRendererMode,
  waitForProductionRenderer,
  type ProductionApplication
} from "./productionHarness";

test("production menu and sender IPC keep window documents isolated", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pluma-production-"));
  const profilePath = path.join(directory, "profile");
  const filePath = path.join(directory, "First.md");
  await writeFile(filePath, "# First\n");
  let production: ProductionApplication | undefined;

  try {
    production = await launchProduction(profilePath, filePath);
    const [secondPage] = await Promise.all([
      production.application.waitForEvent("window"),
      clickApplicationMenuItem(production.application, "New Window")
    ]);
    await waitForProductionRenderer(secondPage);

    await runRendererCommand(production.firstPage, "open-settings");
    await expect(secondPage.getByRole("tab")).toHaveCount(0);
    await runRendererCommand(secondPage, "open-settings");

    await expect(production.firstPage.getByRole("tab")).toHaveCount(2);
    await expect(secondPage.getByRole("tab")).toHaveCount(1);
    await expect(
      production.firstPage.getByRole("tab", { name: "First.md", exact: true })
    ).toBeVisible();
    await expect(
      secondPage.getByRole("tab", { name: "First.md", exact: true })
    ).toHaveCount(0);

    await quitProductionGracefully(production.application);
    production = undefined;
  } finally {
    if (production) await forceCloseProduction(production.application);
    await rm(directory, { recursive: true, force: true });
  }
});

test("graceful quit restores two windows and their retained modes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pluma-production-"));
  const profilePath = path.join(directory, "profile");
  const filePath = path.join(directory, "Restore.md");
  await writeFile(filePath, "# Restore\n");
  const secondFilePath = path.join(directory, "Second.md");
  await writeFile(secondFilePath, "# Second\n");
  let production: ProductionApplication | undefined;

  try {
    production = await launchProduction(profilePath, filePath);
    const [secondPage] = await Promise.all([
      production.application.waitForEvent("window"),
      clickApplicationMenuItem(production.application, "New Window")
    ]);
    await waitForProductionRenderer(secondPage);
    await production.application.evaluate(({ app, BrowserWindow }, target) => {
      BrowserWindow.getAllWindows().at(-1)?.focus();
      app.emit("open-file", { preventDefault() {} }, target);
    }, secondFilePath);
    await secondPage
      .getByRole("tab", { name: "Second.md", exact: true })
      .waitFor();
    await setRendererMode(production.firstPage, "preview");
    await setRendererMode(secondPage, "rich");

    await expect(
      production.firstPage.getByRole("button", { name: "Preview view" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      secondPage.getByRole("button", { name: "Rich view" })
    ).toHaveAttribute("aria-pressed", "true");

    await quitProductionGracefully(production.application);
    production = undefined;
    production = await launchProduction(profilePath);
    await expect.poll(() => production!.application.windows().length).toBe(2);
    const restoredPages = production.application.windows();
    await Promise.all(restoredPages.map(waitForProductionRenderer));

    await expect
      .poll(async () =>
        Promise.all(
          restoredPages.map(async (page) => ({
            preview: await page
              .getByRole("button", { name: "Preview view" })
              .getAttribute("aria-pressed"),
            rich: await page
              .getByRole("button", { name: "Rich view" })
              .getAttribute("aria-pressed")
          }))
        )
      )
      .toEqual(
        expect.arrayContaining([
          { preview: "true", rich: "false" },
          { preview: "false", rich: "true" }
        ])
      );

    await quitProductionGracefully(production.application);
    production = undefined;
  } finally {
    if (production) await forceCloseProduction(production.application);
    await rm(directory, { recursive: true, force: true });
  }
});
