import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page
} from "@playwright/test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.resolve("package.json"));

export type ProductionApplication = {
  application: ElectronApplication;
  firstPage: Page;
};

export function getProductionMainBundle(): string {
  return (
    process.env.PLUMA_MAIN_BUNDLE ??
    path.resolve("apps/desktop/.vite/build/main.js")
  );
}

export async function launchProduction(
  profilePath: string,
  openPath?: string
): Promise<ProductionApplication> {
  const mainBundle = getProductionMainBundle();
  if (!existsSync(mainBundle)) {
    throw new Error(
      `Production main bundle is missing at ${mainBundle}. Run pnpm desktop:package first or set PLUMA_MAIN_BUNDLE.`
    );
  }

  const application = await electron.launch({
    executablePath: getElectronExecutable(),
    args: [
      mainBundle,
      `--user-data-dir=${profilePath}`,
      ...(openPath ? [openPath] : [])
    ]
  });

  try {
    const firstPage = await application.firstWindow();
    await waitForProductionRenderer(firstPage);
    if (openPath)
      await firstPage
        .getByRole("tab", { name: path.basename(openPath), exact: true })
        .waitFor();
    await application.evaluate(({ app, BrowserWindow }) => {
      app.focus({ steal: true });
      BrowserWindow.getAllWindows()[0]?.focus();
    });
    await expect
      .poll(() =>
        application.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getFocusedWindow() !== null
        )
      )
      .toBe(true);
    return { application, firstPage };
  } catch (error) {
    await forceCloseProduction(application);
    throw error;
  }
}

export async function clickApplicationMenuItem(
  application: ElectronApplication,
  label: string
): Promise<void> {
  await application.evaluate(({ BrowserWindow, Menu }, itemLabel) => {
    const findByLabel = (
      items: Electron.MenuItem[],
      targetLabel: string
    ): Electron.MenuItem | null => {
      for (const item of items) {
        if (item.label === targetLabel) return item;
        const nested = item.submenu
          ? findByLabel(item.submenu.items, targetLabel)
          : null;
        if (nested) return nested;
      }
      return null;
    };
    const menu = Menu.getApplicationMenu();
    const item = menu ? findByLabel(menu.items, itemLabel) : null;
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!item || !focusedWindow || !item.click) {
      throw new Error(`Application menu item is unavailable: ${itemLabel}`);
    }
    item.click(item, focusedWindow, {});
  }, label);
}

export async function runRendererCommand(
  page: Page,
  command: string
): Promise<void> {
  await page.evaluate(async (commandId) => {
    const bridge = (
      window as unknown as {
        pluma: { runCommand: (command: string) => Promise<void> };
      }
    ).pluma;
    await bridge.runCommand(commandId);
  }, command);
}

export async function setRendererMode(page: Page, mode: string): Promise<void> {
  await page.evaluate(async (editorMode) => {
    const bridge = (
      window as unknown as {
        pluma: { setEditorMode: (mode: string) => Promise<void> };
      }
    ).pluma;
    await bridge.setEditorMode(editorMode);
  }, mode);
}

export async function waitForProductionRenderer(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as unknown as { pluma?: unknown }).pluma === "object"
  );
  await page.getByRole("tablist", { name: "Open documents" }).waitFor();
}

export async function quitProductionGracefully(
  application: ElectronApplication
): Promise<void> {
  const process = application.process();
  const exited = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Production app did not quit gracefully.")),
      20_000
    );
    process.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  await Promise.allSettled([
    application.evaluate(({ app }) => app.quit()),
    exited
  ]);
  await exited;
}

export async function forceCloseProduction(
  application: ElectronApplication
): Promise<void> {
  const process = application.process();
  if (process.exitCode !== null || process.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    process.once("exit", () => resolve());
    process.kill("SIGKILL");
  });
}

function getElectronExecutable(): string {
  if (process.env.PLUMA_ELECTRON_EXECUTABLE) {
    return process.env.PLUMA_ELECTRON_EXECUTABLE;
  }

  const installedElectron = require("electron") as string;
  if (existsSync(installedElectron)) return installedElectron;

  if (process.platform === "darwin") {
    return path.resolve(
      "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
    );
  }

  return installedElectron;
}
