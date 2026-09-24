/* global window, document, performance, PerformanceObserver, MutationObserver, requestAnimationFrame */
import console from "node:console";
import {
  settleParsing,
  startPhase,
  endPhase,
  selectionPhase,
  scrollingPhase
} from "./richEditorPhases.mjs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cacheDir = await mkdtemp(path.join(os.tmpdir(), "pluma-rich-benchmark-"));
const baselineDraftly = process.env.PLUMA_BASELINE_DRAFTLY;
const draftlyAliases = baselineDraftly
  ? Object.fromEntries(
      Object.entries(
        JSON.parse(
          await readFile(path.join(baselineDraftly, "package.json"), "utf8")
        ).exports
      )
        .sort(([a], [b]) => b.length - a.length)
        .filter(([, value]) => typeof value === "object" && value.import)
        .map(([key, value]) => [
          key === "." ? "draftly" : "draftly" + key.slice(1),
          path.join(baselineDraftly, value.import)
        ])
    )
  : {};
let server;
let browser;
try {
  server = await createServer({
    root: path.join(root, "apps/desktop"),
    configFile: path.join(root, "apps/desktop/vite.renderer.config.ts"),
    cacheDir,
    resolve: { alias: draftlyAliases },
    plugins:
      process.env.PLUMA_BASELINE_SEARCH === "1"
        ? [
            {
              name: "baseline-search-source",
              enforce: "pre",
              load(id) {
                if (id.endsWith("/useEditorSearchController.ts"))
                  return execFileSync(
                    "git",
                    [
                      "show",
                      "HEAD:packages/ui/src/shell/useEditorSearchController.ts"
                    ],
                    { cwd: root, encoding: "utf8" }
                  );
              }
            }
          ]
        : [],
    server: { host: "127.0.0.1", port: 4188, strictPort: true }
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 }
  });
  page.setDefaultTimeout(25000);
  page.on("pageerror", (error) => console.error(error.message));
  await page.addInitScript(() => {
    window.__richBench = {
      mermaidCalls: 0,
      workspaceCommits: 0,
      instrumentedMermaid: false
    };
  });
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(".js") && !url.includes("EditorWorkspace.tsx"))
      return route.continue();
    const response = await route.fetch();
    let body = await response.text();
    if (url.includes("EditorWorkspace.tsx")) {
      body =
        'import benchmarkReact from "/node_modules/.vite/deps/react.js";\n' +
        body;
      // Use the already resolved React dependency URL (temporary cache changes it).
      const reactImport = body
        .match(/from ["']([^"']*react\.js[^"']*)["']/g)
        ?.at(-1);
      if (reactImport)
        body = body.replace(
          'from "/node_modules/.vite/deps/react.js"',
          reactImport
        );
      body = body.replace(
        /function EditorWorkspace\w*\(\) \{/,
        "$& benchmarkReact.useLayoutEffect(() => { window.__richBench.workspaceCommits++; });"
      );
    }
    if (/await mermaid(?:_default)?\.render\(/.test(body)) {
      body = body.replace(
        /await (mermaid(?:_default)?)\.render\(/g,
        "await (window.__richBench.mermaidCalls++, $1.render)("
      );
      body += "\nwindow.__richBench.instrumentedMermaid = true;\n";
    }
    return route.fulfill({ response, body });
  });
  console.log(
    JSON.stringify({
      label: process.argv[2] ?? "measurement",
      node: process.version,
      chromium: browser.version(),
      cpu: os.cpus()[0]?.model
    })
  );
  for (const bytes of [100_000, 500_000, 1_000_000]) {
    await page.goto("http://127.0.0.1:4188/");
    await page.locator(".editor-workspace").waitFor();
    const loading = await page.evaluate(
      async ({ bytes, root }) => {
        const { markdownFixture } = await import(
          `/@fs/${root}/tests/interaction/markdownFixture.ts`
        );
        const { usePlumaStore } = await import(
          `/@fs/${root}/packages/ui/src/index.ts`
        );
        const { createDocumentSession } = await import(
          `/@fs/${root}/packages/core/src/index.ts`
        );
        const doc = createDocumentSession({
          location: {
            kind: "app-draft",
            draftId: "benchmark",
            name: "Benchmark.md"
          },
          metadata: null,
          rawText: markdownFixture(bytes)
        });
        usePlumaStore.getState().setCommandHandlers({
          updateDocumentText: () => {},
          setActiveTabId: () => {},
          setEditorViewMode: () => {}
        });
        const start = performance.now();
        usePlumaStore.getState().hydrateShellSnapshot({
          activeDocument: doc,
          activeDocumentId: doc.id,
          activeTabId: doc.id,
          documents: [doc],
          documentViewModes: { [doc.id]: "rich" },
          explorerNodes: [],
          hasWorkspace: false,
          isBridgeAvailable: true,
          isDevelopment: false,
          editorViewMode: "rich",
          paneSizes: [100],
          tabs: [{ id: doc.id, title: "Benchmark.md", location: doc.location }],
          workspaceLabel: "Benchmark",
          workspacePath: ""
        });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        return performance.now() - start;
      },
      { bytes, root }
    );
    await page
      .locator(".rich-editor .cm-content[contenteditable=true]")
      .waitFor();
    await page.waitForTimeout(1800);
    await settleParsing(page, root);
    await page.waitForTimeout(200);
    const idle = await page.evaluate(async () => {
      const before = { ...window.__richBench };
      let mutations = 0;
      const tasks = [];
      const mo = new MutationObserver((records) => {
        mutations += records.length;
      });
      mo.observe(document.querySelector(".rich-editor"), {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
      const po = new PerformanceObserver((list) =>
        tasks.push(...list.getEntries().map((entry) => entry.duration))
      );
      po.observe({ type: "longtask" });
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      mo.disconnect();
      po.disconnect();
      return {
        mutations,
        longTaskCount: tasks.length,
        longTaskMaxMs: Math.max(0, ...tasks),
        mermaidCalls: window.__richBench.mermaidCalls - before.mermaidCalls,
        workspaceCommits:
          window.__richBench.workspaceCommits - before.workspaceCommits
      };
    });
    await page
      .locator(".rich-editor .cm-content")
      .click({ position: { x: 120, y: 10 } });
    await page.keyboard.press("Control+Home");
    const selection = await selectionPhase(page);
    const beforeTyping = await startPhase(page);
    const typingMs = [];
    for (const text of "benchmark") {
      const start = performance.now();
      await page.keyboard.insertText(text);
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      );
      typingMs.push(performance.now() - start);
    }
    const typingMetrics = await endPhase(page, beforeTyping);
    await settleParsing(page, root);
    const scrollMetrics = await scrollingPhase(page);
    const scrolling = scrollMetrics.times;
    const counters = await page.evaluate(() => ({ ...window.__richBench }));
    if (!counters.instrumentedMermaid || !counters.workspaceCommits)
      throw new Error(
        "Instrumentation did not attach: " + JSON.stringify(counters)
      );
    const percentile = (values, p) =>
      [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
    console.log(
      JSON.stringify({
        bytes,
        hydrationTwoFramesMs: loading,
        idle,
        selection,
        typing: {
          samples: typingMs.length,
          p50Ms: percentile(typingMs, 0.5),
          p95Ms: percentile(typingMs, 0.95),
          ...typingMetrics
        },
        scrolling: {
          ...scrollMetrics,
          samples: scrolling.length,
          p50Ms: percentile(scrolling, 0.5),
          p95Ms: percentile(scrolling, 0.95)
        },
        totalMermaidCalls: counters.mermaidCalls,
        totalWorkspaceCommits: counters.workspaceCommits
      })
    );
  }
} finally {
  await browser?.close();
  await server?.close();
  await rm(cacheDir, { recursive: true, force: true });
}
