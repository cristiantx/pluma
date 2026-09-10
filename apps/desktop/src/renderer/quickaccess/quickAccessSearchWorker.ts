import {
  collectFileResults,
  deduplicateFileCandidates,
  matchFileCandidate,
  prepareFileCandidates,
  prepareFileQuery,
  type FileCandidate,
  type PreparedFileCandidate,
  type RankedFileResult
} from "@pluma/core";
import type {
  QuickAccessWorkerRequest,
  QuickAccessWorkerResponse
} from "./quickAccessSearchAdapter";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<QuickAccessWorkerRequest>) => void) | null;
  postMessage: (message: QuickAccessWorkerResponse) => void;
};
type QueryRequest = Extract<QuickAccessWorkerRequest, { type: "query" }>;
let revision = 0;
let candidates: FileCandidate[] = [];
let prepared: PreparedFileCandidate[] | null = null;
let pending: QueryRequest | null = null;
let running = false;
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function runSearch(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (pending) {
      const query = pending;
      pending = null;
      if (query.revision !== revision) continue;
      try {
        if (!prepared) {
          const building: PreparedFileCandidate[] = [];
          const source = candidates;
          for (let start = 0; start < source.length; start += 100) {
            building.push(
              ...prepareFileCandidates(source.slice(start, start + 100))
            );
            await yieldTask();
            if (query.revision !== revision) break;
          }
          if (query.revision !== revision) continue;
          prepared = building;
        }
        // A newer query may have arrived while normalization was running.
        if (pending) continue;
        const normalizedQuery = prepareFileQuery(query.query);
        const matches: RankedFileResult[] = [];
        for (let start = 0; start < prepared.length; start += 250) {
          for (const candidate of prepared.slice(start, start + 250)) {
            const match = matchFileCandidate(candidate, normalizedQuery);
            if (match) matches.push(match);
          }
          await yieldTask();
          if (pending || query.revision !== revision) break;
        }
        if (pending || query.revision !== revision) continue;
        workerScope.postMessage({
          type: "results",
          revision,
          requestId: query.requestId,
          response: collectFileResults(matches)
        });
      } catch (error) {
        if (!pending && query.revision === revision)
          workerScope.postMessage({
            type: "error",
            revision,
            requestId: query.requestId,
            message:
              error instanceof Error ? error.message : "Unable to search files."
          });
      }
    }
  } finally {
    running = false;
  }
}

workerScope.onmessage = ({ data }) => {
  if (data.type === "index") {
    revision = data.revision;
    candidates = deduplicateFileCandidates(data.candidates);
    prepared = null;
  } else {
    pending = data;
    void runSearch();
  }
};
