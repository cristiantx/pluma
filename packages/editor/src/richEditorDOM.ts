import type { EditorView } from "@codemirror/view";
import { getRichEditorModifiedClickLinkUrl } from "./richEditorLinkClicks.js";
import { resolveRichEditorImageUrls } from "./richEditorImageUrls.js";

export function connectRichEditorDOM(
  view: EditorView,
  getImageBaseUrl: () => string | undefined,
  onOpenLink: (url: string) => void
): () => void {
  const resolveImages = () =>
    resolveRichEditorImageUrls(view.dom, getImageBaseUrl());
  const click = (event: MouseEvent) => {
    const url = getRichEditorModifiedClickLinkUrl(event);
    if (!url) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onOpenLink(url);
  };
  const imageLoaded = () => view.requestMeasure();
  const observer = new MutationObserver(resolveImages);
  observer.observe(view.dom, { childList: true, subtree: true });
  view.dom.addEventListener("click", click, { capture: true });
  view.dom.addEventListener("load", imageLoaded, { capture: true });
  resolveImages();
  return () => {
    observer.disconnect();
    view.dom.removeEventListener("click", click, { capture: true });
    view.dom.removeEventListener("load", imageLoaded, { capture: true });
  };
}
