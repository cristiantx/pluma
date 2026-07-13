import type { DocumentModeConstraint } from "@pluma/core";

export type MarkdownAnalysisRequest = {
  rawText: string;
  requestId: number;
};

export type MarkdownAnalysisResponse =
  | {
      modeConstraint: DocumentModeConstraint;
      requestId: number;
    }
  | {
      error: string;
      requestId: number;
    };
