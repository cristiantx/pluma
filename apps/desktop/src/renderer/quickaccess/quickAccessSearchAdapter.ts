import SearchWorker from "./quickAccessSearchWorker?worker";
import type { FileCandidate, FileSearchResult } from "@pluma/core";

export type QuickAccessSearchResponse = {
  results: FileSearchResult[];
  total: number;
};
export type QuickAccessWorkerRequest =
  | { type: "index"; revision: number; candidates: FileCandidate[] }
  | { type: "query"; revision: number; requestId: number; query: string };
export type QuickAccessWorkerResponse =
  | {
      type: "results";
      revision: number;
      requestId: number;
      response: QuickAccessSearchResponse;
    }
  | { type: "error"; revision: number; requestId: number; message: string };

export type QuickAccessWorker = Pick<
  Worker,
  "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror"
>;
export interface QuickAccessSearchAdapter {
  search(
    candidates: FileCandidate[],
    query: string
  ): Promise<QuickAccessSearchResponse>;
  dispose(): void;
}

function aborted(): DOMException {
  return new DOMException("Search was superseded or disposed.", "AbortError");
}

export function createQuickAccessSearchAdapter(
  createWorker: () => QuickAccessWorker = () => new SearchWorker()
): QuickAccessSearchAdapter {
  const worker = createWorker();
  let candidatesIdentity: FileCandidate[] | null = null;
  let revision = 0;
  let requestId = 0;
  let disposed = false;
  let failure: Error | null = null;
  let pending: {
    requestId: number;
    revision: number;
    resolve: (response: QuickAccessSearchResponse) => void;
    reject: (error: Error) => void;
  } | null = null;
  worker.onmessage = (event: MessageEvent<QuickAccessWorkerResponse>) => {
    const message = event.data;
    if (
      !pending ||
      message.requestId !== pending.requestId ||
      message.revision !== pending.revision
    )
      return;
    const current = pending;
    pending = null;
    if (message.type === "error") current.reject(new Error(message.message));
    else current.resolve(message.response);
  };
  const fail = () => {
    failure = new Error("Quick Open search worker failed.");
    pending?.reject(failure);
    pending = null;
    worker.terminate();
  };
  worker.onerror = fail;
  worker.onmessageerror = fail;
  return {
    search(candidates, query) {
      if (disposed) return Promise.reject(aborted());
      if (failure) return Promise.reject(failure);
      pending?.reject(aborted());
      pending = null;
      requestId += 1;
      return new Promise((resolve, reject) => {
        pending = { requestId, revision, resolve, reject };
        try {
          if (candidatesIdentity !== candidates) {
            revision += 1;
            pending.revision = revision;
            worker.postMessage({
              type: "index",
              revision,
              candidates
            } satisfies QuickAccessWorkerRequest);
            candidatesIdentity = candidates;
          }
          worker.postMessage({
            type: "query",
            revision,
            requestId,
            query
          } satisfies QuickAccessWorkerRequest);
        } catch (error) {
          pending = null;
          reject(error);
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending?.reject(aborted());
      pending = null;
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      candidatesIdentity = null;
    }
  };
}
