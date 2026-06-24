import { createRequire } from "node:module";

import { tests as commonMarkSpecExamples } from "commonmark-spec";
import { describe, expect, it } from "vitest";

import {
  analyzeMarkdownText,
  markdownPipeline,
  renderMarkdownExportHtml
} from "../src/index.js";

type CommonMarkSpecExample = {
  html: string;
  markdown: string;
  number: number;
  section: string;
};

const examples = commonMarkSpecExamples as CommonMarkSpecExample[];
const require = createRequire(import.meta.url);
const commonMarkSpecPackage = require("commonmark-spec/package.json") as {
  version: string;
};

const expectedCommonMarkVersion = "0.31.2";
const expectedExampleCount = 652;
const policyDifferenceSections = new Set(["HTML blocks", "Raw HTML"]);
const rawHtmlTextOnlyExamples = new Set([618, 619, 620, 621, 622, 624, 632]);
const exactRenderExampleNumbers = [
  1, 13, 26, 42, 44, 62, 80, 107, 121, 192, 219, 227, 228, 253, 301, 327, 328,
  350, 482, 592, 594, 640, 648, 650
];

function expandSpecTabs(text: string): string {
  return text.replaceAll("\u2192", "\t");
}

function normalizeHtml(text: string): string {
  return expandSpecTabs(text).replace(/\n+$/u, "");
}

function summarizeExamples(
  examplesToSummarize: CommonMarkSpecExample[]
): string {
  return examplesToSummarize
    .slice(0, 12)
    .map((example) => `#${example.number} ${example.section}`)
    .join(", ");
}

describe("CommonMark compatibility", () => {
  it("uses the expected official CommonMark spec fixture set", () => {
    expect(examples).toHaveLength(expectedExampleCount);
    expect(commonMarkSpecPackage.version).toBe(expectedCommonMarkVersion);
  });

  it("parses every official CommonMark example without rejecting source input", () => {
    const failures = examples.filter((example) => {
      try {
        markdownPipeline.parse(expandSpecTabs(example.markdown));
        return false;
      } catch {
        return true;
      }
    });

    expect(failures, summarizeExamples(failures)).toEqual([]);
  });

  it("keeps official CommonMark HTML examples source-only when they parse as raw HTML", () => {
    const htmlExamples = examples.filter(
      (example) =>
        policyDifferenceSections.has(example.section) &&
        !rawHtmlTextOnlyExamples.has(example.number)
    );
    const failures = htmlExamples.filter(
      (example) =>
        analyzeMarkdownText(expandSpecTabs(example.markdown)).modeConstraint !==
        "source-only"
    );

    expect(htmlExamples.length).toBeGreaterThan(0);
    expect(failures, summarizeExamples(failures)).toEqual([]);
  });

  it("renders representative CommonMark examples to the expected HTML", async () => {
    const renderExamples = exactRenderExampleNumbers.map((number) => {
      const example = examples.find((candidate) => candidate.number === number);

      if (!example) {
        throw new Error(`Missing CommonMark example #${number}.`);
      }

      return example;
    });

    const failures: string[] = [];

    for (const example of renderExamples) {
      const actual = await renderMarkdownExportHtml(
        expandSpecTabs(example.markdown)
      );
      const expected = normalizeHtml(example.html);

      if (normalizeHtml(actual) !== expected) {
        failures.push(`#${example.number} ${example.section}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
