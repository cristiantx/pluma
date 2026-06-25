import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import {
  plumaPreviewClassName,
  renderPreviewContent,
  resolvePreviewImageUrls
} from "./previewRenderer.js";
import type { PreviewRenderResult } from "./previewRenderer.js";
import type { PreviewViewProps } from "./previewViewTypes.js";

export function PreviewView({
  "aria-label": ariaLabel = "Markdown preview",
  documentId,
  imageBaseUrl,
  onOpenLinkRequest,
  rawText,
  resolvedTheme
}: PreviewViewProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [renderedPreview, setRenderedPreview] = useState<PreviewRenderResult>({
    css: "",
    html: ""
  });

  useEffect(() => {
    let isDisposed = false;

    void renderPreviewContent({ rawText, resolvedTheme }).then(
      (nextPreview) => {
        if (!isDisposed) {
          setRenderedPreview(nextPreview);
        }
      }
    );

    return () => {
      isDisposed = true;
    };
  }, [rawText, resolvedTheme]);

  useEffect(() => {
    const content = contentRef.current;

    if (content) {
      resolvePreviewImageUrls(content, imageBaseUrl);
    }
  }, [imageBaseUrl, renderedPreview.html]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;

    if (!link || !event.currentTarget.contains(link)) {
      return;
    }

    const href = link.getAttribute("href");

    if (!href) {
      return;
    }

    event.preventDefault();
    onOpenLinkRequest(href);
  };

  return (
    <section
      aria-label={ariaLabel}
      className={plumaPreviewClassName}
      data-preview-document-id={documentId}
      data-preview-theme={resolvedTheme}
    >
      <style>{renderedPreview.css}</style>
      <div
        ref={contentRef}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: renderedPreview.html }}
      />
    </section>
  );
}
