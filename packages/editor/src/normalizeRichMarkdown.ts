const listItemMarkerPattern = /^[ \t]*(?:[-+*]|\d+[.)]) /;

export function normalizeRichMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
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

    normalizedLines.push(normalizeListMarker(line));
  }

  return normalizedLines.join("\n");
}

function normalizeListMarker(line: string): string {
  return line.replace(/^([ \t]*)\* (\[[ xX]\] )/, "$1- $2");
}
