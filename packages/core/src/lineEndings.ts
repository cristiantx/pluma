export type LineEnding = "crlf" | "lf" | "mixed" | "none";
export type WritableLineEnding = "crlf" | "lf";
export type DefaultLineEnding = WritableLineEnding | "system";

export function detectLineEnding(text: string): LineEnding {
  const crlfMatches = text.match(/\r\n/g)?.length ?? 0;
  const lfMatches = (text.match(/\n/g)?.length ?? 0) - crlfMatches;
  const crMatches = text.match(/\r(?!\n)/g)?.length ?? 0;

  if (crlfMatches === 0 && lfMatches === 0 && crMatches === 0) {
    return "none";
  }

  if (crlfMatches > 0 && lfMatches === 0 && crMatches === 0) {
    return "crlf";
  }

  if (lfMatches > 0 && crlfMatches === 0 && crMatches === 0) {
    return "lf";
  }

  return "mixed";
}

export function resolveDefaultLineEnding(
  preference: DefaultLineEnding,
  platform: NodeJS.Platform = process.platform
): WritableLineEnding {
  if (preference === "crlf" || preference === "lf") {
    return preference;
  }

  return platform === "win32" ? "crlf" : "lf";
}

export function applyLineEnding(
  text: string,
  lineEnding: WritableLineEnding
): string {
  const normalized = text.replace(/\r\n?/g, "\n");

  return lineEnding === "crlf" ? normalized.replace(/\n/g, "\r\n") : normalized;
}

export function formatLineEndingLabel(lineEnding: LineEnding): string {
  switch (lineEnding) {
    case "crlf":
      return "CRLF";
    case "lf":
      return "LF";
    case "mixed":
      return "Mixed";
    case "none":
      return "--";
  }
}
