import { readFile, readdir, stat } from "node:fs/promises";
import process from "node:process";
import { gzipSync } from "node:zlib";
import path from "node:path";

const buildDirectory = path.resolve(".vite/build");
const entries = await readdir(buildDirectory);
const chunkNames = entries.filter(
  (entry) =>
    entry === "main.js" || (entry.startsWith("main-") && entry.endsWith(".js"))
);

if (chunkNames.length !== 1) {
  throw new Error(
    `Expected one hashed main bundle in ${buildDirectory}, found ${chunkNames.length}.`
  );
}

const bundlePath = path.join(buildDirectory, chunkNames[0]);
const bundle = await readFile(bundlePath);
const source = bundle.toString("utf8");
const forbiddenMarkers = [
  ["CodeMirror", "CodeMirror"],
  ["Pluma source editor", "pluma-source-editor"],
  ["react-dom", "react-dom"],
  ["React runtime", "react.production"]
];
const violations = forbiddenMarkers
  .filter(([, marker]) => source.includes(marker))
  .map(([name]) => name);

if (violations.length > 0) {
  throw new Error(
    `Main bundle includes renderer dependencies: ${violations.join(", ")}.`
  );
}

const bundleStats = await stat(bundlePath);
const result = {
  file: path.relative(process.cwd(), bundlePath),
  gzipBytes: gzipSync(bundle).byteLength,
  rawBytes: bundleStats.size
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
