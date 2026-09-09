import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "@playwright/test";

export type PackagedApplication = {
  browser: Browser;
  child: ChildProcess;
  page: Page;
};

export async function launchPackaged(
  executable: string,
  profile: string,
  filePath: string
): Promise<PackagedApplication> {
  const child = spawn(
    executable,
    [`--user-data-dir=${profile}`, "--remote-debugging-port=0", filePath],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  try {
    const endpoint = await new Promise<string>((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(`Packaged app did not expose CDP: ${output.slice(-4000)}`)
        );
      }, 30_000);
      const cleanup = () => {
        clearTimeout(timeout);
        child.stderr?.off("data", onData);
        child.off("error", onError);
        child.off("exit", onExit);
      };
      const onData = (chunk: Buffer) => {
        output += chunk.toString();
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          cleanup();
          resolve(match[1]);
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onExit = (code: number | null) => {
        cleanup();
        reject(
          new Error(`Packaged app exited (${code}): ${output.slice(-4000)}`)
        );
      };
      child.stderr?.on("data", onData);
      child.once("error", onError);
      child.once("exit", onExit);
    });
    const browser = await chromium.connectOverCDP(endpoint);
    try {
      const context = browser.contexts()[0];
      if (!context) throw new Error("Packaged app has no browser context");
      const page =
        context.pages()[0] ??
        (await context.waitForEvent("page", { timeout: 20_000 }));
      await page.waitForURL("file://**", { timeout: 20_000 });
      return { browser, child, page };
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    await terminatePackaged(child);
    throw error;
  }
}

export async function terminatePackaged(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

export async function nativeWindowSize(
  page: Page,
  width: number,
  height: number
) {
  await page.evaluate(({ width, height }) => window.resizeTo(width, height), {
    width,
    height
  });
  await page.waitForFunction(
    ({ width, height }) =>
      window.outerWidth === width && window.outerHeight === height,
    { width, height },
    { timeout: 3000 }
  );
}

export async function nativeCommand(page: Page, command: "save" | "find") {
  await page.evaluate(async (command) => {
    const bridge = (
      window as unknown as {
        pluma: { runCommand(command: string): Promise<void> };
      }
    ).pluma;
    await bridge.runCommand(command);
  }, command);
}
