import type {
  DocumentModeConstraint,
  DocumentSession
} from "./documentSession.js";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";

export type MarkdownParseResult = {
  ast: Root;
  rawText: string;
};

export type MarkdownUnsupportedConstruct = {
  detail: string;
  kind: string;
};

export type MarkdownCapabilityAnalysis = {
  modeConstraint: DocumentModeConstraint;
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

const sourceOnlyNodeTypes = new Set(["html"]);

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"]);

export const markdownPipeline: MarkdownPipeline = {
  analyze(parseResult) {
    return analyzeMarkdownParseResult(parseResult);
  },
  parse(rawText) {
    return parseMarkdown(rawText);
  },
  serialize(session) {
    return serializeMarkdownSession(session);
  }
};

export function parseMarkdown(rawText: string): MarkdownParseResult {
  return {
    ast: processor.parse(rawText) as Root,
    rawText
  };
}

export function analyzeMarkdownText(
  rawText: string
): MarkdownCapabilityAnalysis {
  return analyzeMarkdownParseResult(parseMarkdown(rawText));
}

export function analyzeMarkdownParseResult(
  parseResult: MarkdownParseResult
): MarkdownCapabilityAnalysis {
  const unsupportedConstructs: MarkdownUnsupportedConstruct[] = [];

  visit(parseResult.ast, (node) => {
    if (sourceOnlyNodeTypes.has(node.type)) {
      unsupportedConstructs.push({
        detail:
          "Inline or block HTML is preserved in source mode because rich editing could change execution or rendering semantics.",
        kind: node.type
      });

      return;
    }
  });

  return {
    modeConstraint: unsupportedConstructs.length === 0 ? "none" : "source-only",
    unsupportedConstructs
  };
}

export function getMarkdownDocumentModeConstraint(
  analysis: MarkdownCapabilityAnalysis
): DocumentModeConstraint {
  return analysis.modeConstraint;
}

export function serializeMarkdownSession(
  session: DocumentSession
): MarkdownSerializationResult {
  if (session.modeConstraint === "source-only") {
    const analysis = analyzeMarkdownText(session.rawText);
    return {
      fidelityWarnings: analysis.unsupportedConstructs.map(
        (construct) => construct.detail
      ),
      markdown: session.rawText
    };
  }

  return {
    fidelityWarnings: [],
    markdown: session.rawText
  };
}
