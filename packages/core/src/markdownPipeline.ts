import type { DocumentSession } from "./documentSession.js";

export type MarkdownParseResult = {
  ast: unknown;
  rawText: string;
};

export type MarkdownUnsupportedConstruct = {
  detail: string;
  kind: string;
};

export type MarkdownCapabilityAnalysis = {
  supportsRichMode: boolean;
  unsupportedConstructs: MarkdownUnsupportedConstruct[];
};

export type MarkdownSerializationResult = {
  fidelityWarnings: string[];
  markdown: string;
};

export interface MarkdownPipeline {
  analyze(parseResult: MarkdownParseResult): MarkdownCapabilityAnalysis;
  parse(rawText: string): MarkdownParseResult;
  serialize(session: DocumentSession): MarkdownSerializationResult;
}
