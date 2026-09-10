import type { MatchRange } from "./searchTypes.js";

export interface SearchText {
  characters: string[];
  offsets: MatchRange[];
  boundaries: boolean[];
}

const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });

export function prepareSearchText(value: string): SearchText {
  const characters: string[] = [];
  const offsets: MatchRange[] = [];
  const boundaries: boolean[] = [];
  let previous = "";
  for (const part of segmenter.segment(value)) {
    const folded = part.segment
      .normalize("NFC")
      .toLowerCase()
      .replaceAll("ß", "ss")
      .replaceAll("ς", "σ")
      .replaceAll("\\", "/");
    const boundary =
      !previous ||
      /[^\p{L}\p{N}]/u.test(previous) ||
      (/\p{Ll}/u.test(previous) && /\p{Lu}/u.test(part.segment));
    for (const character of folded) {
      characters.push(character);
      offsets.push({
        start: part.index,
        end: part.index + part.segment.length
      });
      boundaries.push(boundary);
    }
    previous = part.segment;
  }
  return { characters, offsets, boundaries };
}

export interface FuzzyMatch {
  tier: number;
  gaps: number;
  boundaryPenalty: number;
  ranges: MatchRange[];
}

export function mergeMatchRanges(ranges: readonly MatchRange[]): MatchRange[] {
  const merged: MatchRange[] = [];
  for (const range of [...ranges].sort(
    (a, b) => a.start - b.start || a.end - b.end
  )) {
    const last = merged.at(-1);
    if (last && range.start <= last.end)
      last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function matchSearchText(
  text: SearchText,
  token: readonly string[]
): FuzzyMatch | null {
  if (!token.length)
    return { tier: 0, gaps: 0, boundaryPenalty: 0, ranges: [] };
  // Compare every possible start: a later contiguous/boundary match can beat an early sparse one.
  let best: FuzzyMatch | null = null;
  for (let start = 0; start < text.characters.length; start += 1) {
    if (text.characters[start] !== token[0]) continue;
    const positions = [start];
    let cursor = start + 1;
    for (let index = 1; index < token.length; index += 1) {
      while (
        cursor < text.characters.length &&
        text.characters[cursor] !== token[index]
      )
        cursor += 1;
      if (cursor === text.characters.length) break;
      positions.push(cursor++);
    }
    if (positions.length !== token.length) continue;
    const end = positions.at(-1)!;
    const gaps = end - start + 1 - token.length;
    const tier = gaps
      ? 3
      : start === 0
        ? token.length === text.characters.length
          ? 0
          : 1
        : 2;
    const boundaryPenalty = positions.filter((position, index) =>
      index === 0 || position !== positions[index - 1]! + 1
        ? !text.boundaries[position]
        : false
    ).length;
    const match = {
      tier,
      gaps,
      boundaryPenalty,
      ranges: mergeMatchRanges(
        positions.map((position) => text.offsets[position]!)
      )
    };
    if (
      !best ||
      tier < best.tier ||
      (tier === best.tier &&
        (boundaryPenalty < best.boundaryPenalty ||
          (boundaryPenalty === best.boundaryPenalty && gaps < best.gaps)))
    )
      best = match;
  }
  return best;
}
