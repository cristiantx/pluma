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

export function visibleOffsetFromMarkdownSource(
  markdown: string,
  sourceOffset: number
): number {
  return scanMarkdownVisibleOffsets(markdown, sourceOffset, null);
}

export function sourceOffsetFromMarkdownVisible(
  markdown: string,
  visibleOffset: number
): number {
  return scanMarkdownVisibleOffsets(markdown, null, Math.max(0, visibleOffset));
}

function scanMarkdownVisibleOffsets(
  markdown: string,
  sourceTarget: number | null,
  visibleTarget: number | null
): number {
  let index = 0;
  let isLineStart = true;
  let lastSourceOffset = 0;
  let visibleOffset = 0;

  while (index < markdown.length) {
    const character = markdown[index] ?? "";
    const nextCharacter = markdown[index + 1] ?? "";

    if (character === "\r") {
      index += 1;
      continue;
    }

    if (character === "\n") {
      if (sourceTarget !== null && index >= sourceTarget) {
        return visibleOffset;
      }

      if (visibleTarget !== null && visibleOffset === visibleTarget) {
        return index;
      }

      lastSourceOffset = index;
      visibleOffset += 1;
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

    if (sourceTarget !== null && index >= sourceTarget) {
      return visibleOffset;
    }

    if (visibleTarget !== null && visibleOffset === visibleTarget) {
      return index;
    }

    lastSourceOffset = index;
    visibleOffset += 1;
    index += 1;
    isLineStart = false;
  }

  return sourceTarget !== null ? visibleOffset : lastSourceOffset;
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

  const orderedListStart = index;

  while (isAsciiDigit(markdown[index])) {
    index += 1;
  }

  if (
    index > orderedListStart &&
    (markdown[index] === "." || markdown[index] === ")") &&
    isWhitespace(markdown[index + 1])
  ) {
    return index - startIndex + 2;
  }

  return 0;
}

function isAsciiDigit(value: string | undefined): boolean {
  return value !== undefined && value >= "0" && value <= "9";
}

function isWhitespace(value: string | undefined): boolean {
  return value === " " || value === "\t" || value === "\n" || value === "\r";
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
