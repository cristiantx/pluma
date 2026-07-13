import { parentPort } from "node:worker_threads";

import { analyzeMarkdownText } from "@pluma/core";

import type {
  MarkdownAnalysisRequest,
  MarkdownAnalysisResponse
} from "./markdownAnalysisProtocol";

if (!parentPort) {
  throw new Error("Markdown analysis worker requires a parent port.");
}

const workerPort = parentPort;

workerPort.on("message", (request: MarkdownAnalysisRequest) => {
  let response: MarkdownAnalysisResponse;

  try {
    response = {
      modeConstraint: analyzeMarkdownText(request.rawText).modeConstraint,
      requestId: request.requestId
    };
  } catch (error) {
    response = {
      error:
        error instanceof Error
          ? error.message
          : "Markdown capability analysis failed.",
      requestId: request.requestId
    };
  }

  workerPort.postMessage(response);
});
