import type { DocumentCapability, DocumentSession } from "./documentSession.js";
import { frontmatterToMarkdown } from "mdast-util-frontmatter";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
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

const richModeSupportedNodeTypes = new Set([
  "blockquote",
  "break",
  "code",
  "delete",
  "emphasis",
  "footnoteDefinition",
  "footnoteReference",
  "heading",
  "image",
  "imageReference",
  "inlineCode",
  "link",
  "linkReference",
  "list",
  "listItem",
  "paragraph",
  "root",
  "strong",
  "table",
  "tableCell",
  "tableRow",
  "text",
  "thematicBreak",
  "yaml",
  "definition"
]);

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

    if (!richModeSupportedNodeTypes.has(node.type)) {
      unsupportedConstructs.push({
        detail: `Unsupported Markdown AST node "${node.type}" is preserved in source mode.`,
        kind: node.type
      });
    }
  });

  return {
    supportsRichMode: unsupportedConstructs.length === 0,
    unsupportedConstructs
  };
}

export function getMarkdownDocumentCapability(
  analysis: MarkdownCapabilityAnalysis
): DocumentCapability {
  return analysis.supportsRichMode ? "rich-safe" : "source-only";
}

export function serializeMarkdownSession(
  session: DocumentSession
): MarkdownSerializationResult {
  const parseResult = parseMarkdown(session.rawText);
  const analysis = analyzeMarkdownParseResult(parseResult);

  if (!analysis.supportsRichMode) {
    return {
      fidelityWarnings: analysis.unsupportedConstructs.map(
        (construct) => construct.detail
      ),
      markdown: session.rawText
    };
  }

  return guardMarkdownRoundTrip(parseResult);
}

export function guardMarkdownRoundTrip(
  parseResult: MarkdownParseResult
): MarkdownSerializationResult {
  const markdown = toMarkdown(parseResult.ast, {
    extensions: [gfmToMarkdown(), frontmatterToMarkdown(["yaml"])]
  });

  if (normalizeMarkdown(markdown) !== normalizeMarkdown(parseResult.rawText)) {
    return {
      fidelityWarnings: [
        "Markdown serialization changed the source text. Source text was preserved to avoid losing document fidelity."
      ],
      markdown: parseResult.rawText
    };
  }

  return {
    fidelityWarnings: [],
    markdown
  };
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").replace(/\n+$/g, "\n");
}
