const linkSelector = ".cm-draftly-link-styled, .cm-draftly-link-wrapper";
const tooltipSelector = ".cm-draftly-link-tooltip";

export function getRichEditorModifiedClickLinkUrl(
  event: MouseEvent
): string | null {
  if ((!event.metaKey && !event.ctrlKey) || event.button !== 0) {
    return null;
  }

  const target =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>(linkSelector)
      : null;

  if (!target) {
    return null;
  }

  return (
    target.querySelector<HTMLElement>(tooltipSelector)?.textContent?.trim() ||
    null
  );
}
