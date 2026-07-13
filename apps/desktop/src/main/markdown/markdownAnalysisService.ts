import { Worker } from "node:worker_threads";

import type { DocumentModeConstraint } from "@pluma/core";

import type {
  MarkdownAnalysisRequest,
  MarkdownAnalysisResponse
} from "./markdownAnalysisProtocol";

type WorkerLike = Pick<Worker, "on" | "postMessage" | "terminate">;
type PendingAnalysis = {
  reject: (error: Error) => void;
  resolve: (modeConstraint: DocumentModeConstraint) => void;
};

export type MarkdownAnalysisServiceOptions = {
  createWorker?: (workerPath: string) => WorkerLike;
  onError: (message: string) => void;
  workerPath: string;
};

export class MarkdownAnalysisService {
  private nextRequestId = 0;
  private readonly pendingAnalyses = new Map<number, PendingAnalysis>();
  private worker: WorkerLike | null = null;

  constructor(private readonly options: MarkdownAnalysisServiceOptions) {}

  async analyze(rawText: string): Promise<DocumentModeConstraint> {
    if (!rawText.includes("<")) {
      return "none";
    }

    try {
      return await this.requestAnalysis(rawText);
    } catch (error) {
      this.options.onError(
        error instanceof Error
          ? `Markdown analysis failed: ${error.message}`
          : "Markdown analysis failed."
      );
      return "source-only";
    }
  }

  dispose(): void {
    const worker = this.worker;
    this.worker = null;
    this.rejectPending(new Error("Markdown analysis service stopped."));
    if (worker) {
      void worker.terminate();
    }
  }

  private requestAnalysis(rawText: string): Promise<DocumentModeConstraint> {
    const worker = this.getWorker();
    const requestId = ++this.nextRequestId;

    return new Promise((resolve, reject) => {
      this.pendingAnalyses.set(requestId, { reject, resolve });
      const request: MarkdownAnalysisRequest = { rawText, requestId };

      try {
        worker.postMessage(request);
      } catch (error) {
        this.pendingAnalyses.delete(requestId);
        reject(toError(error));
      }
    });
  }

  private getWorker(): WorkerLike {
    if (this.worker) {
      return this.worker;
    }

    const worker = this.options.createWorker
      ? this.options.createWorker(this.options.workerPath)
      : new Worker(this.options.workerPath);
    worker.on("message", (response: MarkdownAnalysisResponse) => {
      const pending = this.pendingAnalyses.get(response.requestId);

      if (!pending) {
        return;
      }

      this.pendingAnalyses.delete(response.requestId);
      if ("error" in response) {
        pending.reject(new Error(response.error));
      } else {
        pending.resolve(response.modeConstraint);
      }
    });
    worker.on("error", (error) => {
      this.handleWorkerFailure(toError(error));
    });
    worker.on("exit", (code) => {
      if (this.worker === worker && code !== 0) {
        this.handleWorkerFailure(
          new Error(`Markdown analysis worker exited with code ${code}.`)
        );
      }
    });
    this.worker = worker;
    return worker;
  }

  private handleWorkerFailure(error: Error): void {
    const worker = this.worker;
    this.worker = null;
    this.rejectPending(error);
    if (worker) {
      void worker.terminate();
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pendingAnalyses.values()) {
      pending.reject(error);
    }

    this.pendingAnalyses.clear();
  }
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("Markdown capability analysis failed.");
}
