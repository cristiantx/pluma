export function findMarkdownHeadingAnchorPosition(
  markdown: string,
  fragment: string
): number | null {
  const targetSlug = normalizeFragment(fragment);

  if (!targetSlug) {
    return null;
  }

  const slugCounts = new Map<string, number>();
  let offset = 0;

  for (const line of markdown.split(/\n/)) {
    const headingText = getAtxHeadingText(line);

    if (headingText) {
      const baseSlug = slugifyHeading(headingText);
      const count = slugCounts.get(baseSlug) ?? 0;
      const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
      slugCounts.set(baseSlug, count + 1);

      if (slug === targetSlug) {
        return offset;
      }
    }

    offset += line.length + 1;
  }

  return null;
}

function normalizeFragment(fragment: string): string {
  try {
    return slugifyHeading(decodeURIComponent(fragment).replace(/^#+/, ""));
  } catch {
    return slugifyHeading(fragment.replace(/^#+/, ""));
  }
}

function getAtxHeadingText(line: string): string | null {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);

  return match?.[2] ?? null;
}

function slugifyHeading(heading: string): string {
  return heading
    .replace(/[`*_~[\]()]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}
