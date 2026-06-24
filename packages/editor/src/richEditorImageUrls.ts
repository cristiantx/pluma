const imageSelector = "img.cm-draftly-image";
const originalSrcAttribute = "data-pluma-original-src";

export function resolveRichEditorImageUrls(
  root: ParentNode,
  baseUrl: string | undefined
): void {
  for (const image of root.querySelectorAll<HTMLImageElement>(imageSelector)) {
    const originalSrc =
      image.getAttribute(originalSrcAttribute) ??
      image.getAttribute("src") ??
      "";

    if (!image.hasAttribute(originalSrcAttribute)) {
      image.setAttribute(originalSrcAttribute, originalSrc);
    }

    const nextSrc = resolveRichEditorImageUrl(originalSrc, baseUrl);

    if (image.getAttribute("src") !== nextSrc) {
      image.setAttribute("src", nextSrc);
    }
  }
}

export function resolveRichEditorImageUrl(
  sourceUrl: string,
  baseUrl: string | undefined
): string {
  if (!baseUrl || !sourceUrl || isExternallyResolvedUrl(sourceUrl)) {
    return sourceUrl;
  }

  try {
    return new URL(sourceUrl, baseUrl).href;
  } catch {
    return sourceUrl;
  }
}

function isExternallyResolvedUrl(sourceUrl: string): boolean {
  return (
    /^[A-Za-z][A-Za-z\d+.-]*:/.test(sourceUrl) ||
    sourceUrl.startsWith("//") ||
    sourceUrl.startsWith("#")
  );
}
