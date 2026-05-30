import prettier from "prettier/standalone";
import markdownPlugin from "prettier/plugins/markdown";
import yamlPlugin from "prettier/plugins/yaml";

export type MarkdownFormatResult = {
  markdown: string;
};

const listItemMarkerPattern = /^[ \t]*(?:[-+*]|\d+[.)]) /;

export async function formatMarkdownText(
  rawText: string
): Promise<MarkdownFormatResult> {
  const normalizedText = normalizeAccidentalLooseLists(rawText);
  const markdown = await prettier.format(normalizedText, {
    endOfLine: "lf",
    parser: "markdown",
    plugins: [markdownPlugin, yamlPlugin],
    proseWrap: "preserve"
  });

  return {
    markdown
  };
}

export function normalizeAccidentalLooseLists(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const normalizedLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (
      line === "" &&
      listItemMarkerPattern.test(normalizedLines.at(-1) ?? "") &&
      listItemMarkerPattern.test(lines[index + 1] ?? "")
    ) {
      continue;
    }

    normalizedLines.push(line);
  }

  return normalizedLines.join("\n");
}
