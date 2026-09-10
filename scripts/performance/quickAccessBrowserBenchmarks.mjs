/* global window, document, performance, PerformanceObserver, self */
import console from "node:console";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cacheDir = await mkdtemp(
  path.join(os.tmpdir(), "pluma-search-benchmark-")
);
let server;
let browser;
try {
  server = await createServer({
    configFile: false,
    root,
    cacheDir,
    server: { host: "127.0.0.1", port: 4188, strictPort: true },
    resolve: {
      alias: {
        "@pluma/core/quick-access": path.join(
          root,
          "packages/core/src/quickAccess/index.ts"
        )
      }
    },
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("worker", async (worker) => {
    console.log(
      JSON.stringify({
        workerSchedulerYield: await worker.evaluate(
          () => typeof self.scheduler?.yield === "function"
        )
      })
    );
  });
  await page.route("**/__quick-access-benchmark", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><input aria-label="Responsiveness probe"><div id="result"></div>'
    })
  );
  await page.goto("http://127.0.0.1:4188/__quick-access-benchmark");
  console.log(
    JSON.stringify({
      node: process.version,
      chromium: browser.version(),
      os: os.release(),
      cpu: os.cpus()[0]?.model,
      arch: process.arch,
      memoryGiB: os.totalmem() / 1024 ** 3
    })
  );
  for (const count of [1000, 10000, 50000]) {
    const measurement = await page.evaluate(async (count) => {
      const { createQuickAccessSearchAdapter } =
        await import("/apps/desktop/src/renderer/quickaccess/quickAccessSearchAdapter.ts");
      const candidates = Array.from({ length: count }, (_, index) => {
        const name =
          index % 7 === 0 ? "Cafe\u0301-😀.md" : `note-${index % 100}.md`;
        const relativePath = `project-${index % 100}/notes/long-directory-${Math.floor(index / 100)}/${name}`;
        return {
          id: String(index),
          name,
          path: `/workspace/${relativePath}`,
          relativePath,
          documentId: null,
          recency: null
        };
      });
      const delays = [];
      const longTasks = [];
      const observer = new PerformanceObserver((entries) => {
        longTasks.push(...entries.getEntries().map((entry) => entry.duration));
      });
      observer.observe({ type: "longtask" });
      let last = performance.now();
      const timer = window.setInterval(() => {
        const now = performance.now();
        delays.push(Math.max(0, now - last - 10));
        last = now;
      }, 10);
      const percentile = (values, fraction) =>
        [...values].sort((a, b) => a - b)[
          Math.max(0, Math.ceil(values.length * fraction) - 1)
        ] ?? 0;
      const adapter = createQuickAccessSearchAdapter();
      const queries = [
        "",
        "note",
        "café",
        "note 12",
        "project-12/notes",
        "zzzz-no-match"
      ];
      const start = performance.now();
      await adapter.search(candidates, "note");
      const coldFirstResultMs = performance.now() - start;
      const queriesMs = [];
      for (let round = 0; round < 3; round += 1) {
        for (const query of queries) {
          const start = performance.now();
          await adapter.search(candidates, query);
          queriesMs.push(performance.now() - start);
        }
      }
      const obsolete = adapter.search(candidates, "note").then(
        () => "unexpected-success",
        (error) => error.name
      );
      const supersedeStart = performance.now();
      const latest = adapter.search(candidates, "café");
      const cancellationResult = await obsolete;
      const promiseAbortMs = performance.now() - supersedeStart;
      await latest;
      const replacementResultMs = performance.now() - supersedeStart;
      const refreshStart = performance.now();
      await adapter.search([...candidates], "note");
      const refreshResultMs = performance.now() - refreshStart;
      document.getElementById("result").textContent = "complete";
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      window.clearInterval(timer);
      observer.disconnect();
      adapter.dispose();
      return {
        candidates: count,
        coldFirstResultMs,
        warmQueryP50Ms: percentile(queriesMs, 0.5),
        warmQueryP95Ms: percentile(queriesMs, 0.95),
        warmQueryMaxMs: Math.max(...queriesMs),
        rendererLongTaskCount: longTasks.length,
        rendererLongTaskMaxMs: Math.max(0, ...longTasks),
        timerDelayP95Ms: percentile(delays, 0.95),
        timerDelayMaxMs: Math.max(0, ...delays),
        timerSamples: delays.length,
        cancellationResult,
        promiseAbortMs,
        replacementResultMs,
        refreshResultMs
      };
    }, count);
    console.log(JSON.stringify(measurement));
  }
} finally {
  await browser?.close();
  await server?.close();
  await rm(cacheDir, { recursive: true, force: true });
}
