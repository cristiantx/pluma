import { readFile, stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { gzipSync } from "node:zlib";

import { analyzeMarkdownText } from "../../packages/core/dist/markdownPipeline.js";
import { findTextMatches } from "../../packages/editor/dist/editorSearch.js";
import { EditorState } from "@codemirror/state";
import { getSourceCursorAnchor } from "../../packages/editor/dist/sourceEditorInterop.js";
import { updateSourceSearchMatchCache } from "../../packages/editor/dist/sourceSearchDecorations.js";
import { mapWithConcurrency } from "../../apps/desktop/dist/src/main/runtime/asyncConcurrency.js";
import { PendingDocumentTextSync } from "../../apps/desktop/dist/src/preload/documentTextSync.js";

const sizes = [100_000, 500_000, 1_000_000];
const documents = new Map(
  sizes.map((size) => [size, createMarkdownDocument(size)])
);
const results = {
  bundle: await measureBundles(),
  cursorMapping: sizes.map((size) => {
    const state = EditorState.create({
      doc: documents.get(size),
      selection: { anchor: Math.floor(size / 2) }
    });
    // Snapshot copying uses source coordinates directly; state setup is not timed.
    return {
      bytes: size,
      medianMs: medianDuration(20, () =>
        getSourceCursorAnchor({ state }, "benchmark", "rich")
      )
    };
  }),
  ipc: measureDocumentTextSync(),
  markdownAnalysis: sizes.map((size) => {
    const rawText = documents.get(size);
    return {
      bytes: size,
      medianMs: medianDuration(3, () => analyzeMarkdownText(rawText))
    };
  }),
  restoreConcurrency: await measureRestoreConcurrency(),
  search: sizes.map((size) => {
    const rawText = documents.get(size);
    return {
      bytes: size,
      medianMs: medianDuration(5, () =>
        findTextMatches(rawText, {
          caseSensitive: false,
          regexp: false,
          replace: "",
          search: "benchmark-target",
          wholeWord: false
        })
      )
    };
  }),
  searchSelectionCache: measureSearchSelectionCache()
};

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);

function createMarkdownDocument(size) {
  const line = "## Benchmark paragraph with **bold** text and a link.\n";
  const suffix = "\n<aside>benchmark-target</aside>\n";
  return `${line
    .repeat(Math.ceil(size / line.length))
    .slice(0, size - suffix.length)}${suffix}`;
}

function medianDuration(iterations, operation) {
  const durations = [];

  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    operation();
    durations.push(performance.now() - start);
  }

  durations.sort((left, right) => left - right);
  return round(durations[Math.floor(durations.length / 2)] ?? 0);
}

function measureDocumentTextSync() {
  const sent = [];
  const sync = new PendingDocumentTextSync((documentId, rawText) => {
    sent.push({ documentId, rawText });
  });

  for (let index = 0; index < 100; index += 1) {
    sync.schedule("benchmark", `edit-${index}`);
  }

  sync.flush();
  return {
    edits: 100,
    latestText: sent.at(-1)?.rawText,
    sends: sent.length
  };
}

function measureSearchSelectionCache() {
  let textReads = 0;
  const query = {
    caseSensitive: false,
    regexp: false,
    replace: "",
    search: "benchmark-target",
    wholeWord: false
  };
  let cache = updateSourceSearchMatchCache(null, query, true, () => {
    textReads += 1;
    return documents.get(1_000_000);
  });

  for (let index = 0; index < 1_000; index += 1) {
    cache = updateSourceSearchMatchCache(cache, query, false, () => {
      textReads += 1;
      return documents.get(1_000_000);
    });
  }

  return { selectionUpdates: 1_000, textReads };
}

async function measureRestoreConcurrency() {
  let active = 0;
  let maxActive = 0;
  const completionOrder = [];

  await mapWithConcurrency(
    Array.from({ length: 6 }, (_, index) => index),
    2,
    async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(value % 2);
      completionOrder.push(value);
      active -= 1;
    }
  );

  return { completionOrder, maxActive };
}

async function measureBundles() {
  const main = await getBundleStats("apps/desktop/.vite/build/main.js");
  const worker = await getBundleStats(
    "apps/desktop/.vite/build/markdownAnalysisWorker.js"
  );
  return { main, worker };
}

async function getBundleStats(file) {
  const contents = await readFile(file);
  return {
    file,
    gzipBytes: gzipSync(contents).byteLength,
    rawBytes: (await stat(file)).size
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
