export type MarkdownVisibleTextProjection = {
  sourceOffsets: Array<number | null>;
  text: string;
};

export function projectMarkdownVisibleText(
  markdown: string
): MarkdownVisibleTextProjection {
  const sourceOffsets: Array<number | null> = [];
  let text = "";
  let index = 0;
  let isLineStart = true;

  while (index < markdown.length) {
    const character = markdown[index] ?? "";
    const nextCharacter = markdown[index + 1] ?? "";

    if (character === "\r") {
      index += 1;
      continue;
    }

    if (character === "\n") {
      text += "\n";
      sourceOffsets.push(index);
      index += 1;
      isLineStart = true;
      continue;
    }

    if (isLineStart) {
      const skipped = countBlockPrefixCharacters(markdown, index);

      if (skipped > 0) {
        index += skipped;
        isLineStart = false;
        continue;
      }
    }

    if (character === "[" && nextCharacter === "]") {
      index += 2;
      isLineStart = false;
      continue;
    }

    if (isInlineMarker(markdown, index)) {
      index += character === "*" && nextCharacter === "*" ? 2 : 1;
      isLineStart = false;
      continue;
    }

    text += character;
    sourceOffsets.push(index);
    index += 1;
    isLineStart = false;
  }

  return { sourceOffsets, text };
}

export function visibleOffsetFromSourceOffset(
  projection: MarkdownVisibleTextProjection,
  sourceOffset: number
): number {
  const exactIndex = projection.sourceOffsets.findIndex(
    (offset) => offset !== null && offset >= sourceOffset
  );

  return exactIndex >= 0 ? exactIndex : projection.text.length;
}

export function sourceOffsetFromVisibleOffset(
  projection: MarkdownVisibleTextProjection,
  visibleOffset: number
): number {
  const clampedOffset = Math.max(
    0,
    Math.min(visibleOffset, projection.sourceOffsets.length - 1)
  );
  const sourceOffset = projection.sourceOffsets[clampedOffset];

  if (sourceOffset !== null && sourceOffset !== undefined) {
    return sourceOffset;
  }

  const fallbackOffset = projection.sourceOffsets.find(
    (offset) => offset !== null
  );

  return fallbackOffset ?? 0;
}

function countBlockPrefixCharacters(
  markdown: string,
  startIndex: number
): number {
  let index = startIndex;

  while (markdown[index] === " " || markdown[index] === "\t") {
    index += 1;
  }

  if (markdown[index] === ">") {
    return index - startIndex + (markdown[index + 1] === " " ? 2 : 1);
  }

  if (markdown[index] === "#") {
    while (markdown[index] === "#") {
      index += 1;
    }

    return markdown[index] === " " ? index - startIndex + 1 : 0;
  }

  if (
    (markdown[index] === "-" ||
      markdown[index] === "*" ||
      markdown[index] === "+") &&
    markdown[index + 1] === " "
  ) {
    return index - startIndex + 2;
  }

  const orderedListMatch = /^\d+[.)]\s/.exec(markdown.slice(index));

  if (orderedListMatch) {
    return index - startIndex + orderedListMatch[0].length;
  }

  return 0;
}

function isInlineMarker(markdown: string, index: number): boolean {
  const character = markdown[index];

  if (character === "`" || character === "_" || character === "~") {
    return true;
  }

  if (character === "*") {
    return true;
  }

  return character === "\\" && Boolean(markdown[index + 1]);
}
