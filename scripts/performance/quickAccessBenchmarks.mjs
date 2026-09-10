import os from "node:os";
import console from "node:console";
import process from "node:process";
import { performance } from "node:perf_hooks";
import {
  collectFileResults,
  matchFileCandidate,
  prepareFileCandidates,
  prepareFileQuery
} from "../../packages/core/dist/quickAccess/fileRanking.js";

const queries = [
  "",
  "note",
  "café",
  "note 12",
  "project-12/notes",
  "zzzz-no-match"
];
const rounded = (value) => Math.round(value * 100) / 100;
const percentile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
function candidatesFor(count) {
  return Array.from({ length: count }, (_, index) => {
    const name =
      index % 7 === 0 ? "Cafe\u0301-😀.md" : `note-${index % 100}.md`;
    const relativePath = `project-${index % 100}/notes/long-directory-${Math.floor(index / 100)}/${name}`;
    return {
      id: String(index),
      name,
      path: `/workspace/${relativePath}`,
      relativePath,
      documentId: index % 101 === 0 ? `document-${index}` : null,
      recency: index % 37 === 0 ? index : null
    };
  });
}
console.log(
  JSON.stringify({
    runtime: process.version,
    platform: process.platform,
    release: os.release(),
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryGiB: rounded(os.totalmem() / 1024 ** 3),
    queries,
    queryRounds: 5,
    indexRuns: 3,
    gcAvailable: Boolean(globalThis.gc)
  })
);
for (const count of [1000, 10000, 50000]) {
  const candidates = candidatesFor(count);
  const indexTimes = [];
  let prepared;
  for (let run = 0; run < 3; run += 1) {
    prepared = null;
    globalThis.gc?.();
    const start = performance.now();
    prepared = prepareFileCandidates(candidates);
    indexTimes.push(performance.now() - start);
  }
  const queryTimes = [];
  const byQuery = new Map(queries.map((query) => [query, []]));
  for (let round = 0; round < 5; round += 1) {
    for (const query of queries) {
      const start = performance.now();
      const normalized = prepareFileQuery(query);
      const matches = [];
      for (const candidate of prepared) {
        const match = matchFileCandidate(candidate, normalized);
        if (match) matches.push(match);
      }
      const result = collectFileResults(matches);
      if (result.results.length > 50) throw new Error("Result cap exceeded");
      const elapsed = performance.now() - start;
      queryTimes.push(elapsed);
      byQuery.get(query).push(elapsed);
    }
  }
  console.log(
    JSON.stringify({
      candidates: count,
      uniqueCandidates: prepared.length,
      indexFirstMs: rounded(indexTimes[0]),
      indexWarmMeanMs: rounded((indexTimes[1] + indexTimes[2]) / 2),
      queryP50Ms: rounded(percentile(queryTimes, 0.5)),
      queryP95Ms: rounded(percentile(queryTimes, 0.95)),
      queryMaxMs: rounded(Math.max(...queryTimes)),
      queryMediansMs: Object.fromEntries(
        [...byQuery].map(([query, times]) => [
          query,
          rounded(percentile(times, 0.5))
        ])
      )
    })
  );
}
