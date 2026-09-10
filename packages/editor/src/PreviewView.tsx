import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import {
  plumaPreviewClassName,
  renderPreviewContent,
  resolvePreviewImageUrls
} from "./previewRenderer.js";
import type { PreviewRenderResult } from "./previewRenderer.js";
import { sizePreviewDiagrams } from "./previewDiagramSizing.js";
import type { PreviewViewProps } from "./previewViewTypes.js";

export function PreviewView({
  "aria-label": ariaLabel = "Markdown preview",
  documentId,
  imageBaseUrl,
  onError,
  onOpenLinkRequest,
  rawText,
  resolvedTheme
}: PreviewViewProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [renderedPreview, setRenderedPreview] = useState<PreviewRenderResult>({
    css: "",
    html: ""
  });
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    setRenderError(null);

    void renderPreviewContent({ rawText, resolvedTheme })
      .then((nextPreview) => {
        if (!isDisposed) {
          setRenderedPreview(nextPreview);
        }
      })
      .catch((error: unknown) => {
        if (isDisposed) {
          return;
        }

        const renderError = toError(error, "Markdown preview failed to load.");
        setRenderError(renderError.message);
        onError?.(renderError);
      });

    return () => {
      isDisposed = true;
    };
  }, [onError, rawText, resolvedTheme]);

  useEffect(() => {
    const content = contentRef.current;

    if (content) {
      resolvePreviewImageUrls(content, imageBaseUrl);
      sizePreviewDiagrams(content);
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
      {renderError ? (
        <p className="editor-load-error" role="alert">
          {renderError}
        </p>
      ) : null}
      <style>{renderedPreview.css}</style>
      <div
        ref={contentRef}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: renderedPreview.html }}
      />
    </section>
  );
}

function toError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}
