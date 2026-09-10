import { useLayoutEffect, useRef } from "react";
import { getQuickAccessEditorTarget } from "./quickAccessEditorTarget.js";

export function useQuickAccessFocus(openingId: number, open: boolean) {
  const origin = useRef<{
    element: HTMLElement | null;
    documentId: string | null;
  } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const element =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    origin.current = {
      element,
      documentId: element?.closest(".cm-editor")
        ? (getQuickAccessEditorTarget()?.documentId ?? null)
        : null
    };
  }, [openingId]);
  const restore = (destination = false) => {
    requestAnimationFrame(() => {
      if (!document.hasFocus()) return;
      const target = getQuickAccessEditorTarget();
      if (destination) {
        target?.focus();
        return;
      }
      const previous = origin.current;
      if (previous?.documentId && target?.documentId === previous.documentId) {
        target.focus();
        return;
      }
      if (
        previous?.element?.isConnected &&
        !previous.element.closest("dialog")
      ) {
        previous.element.focus();
        return;
      }
      if (target) target.focus();
      else
        document
          .querySelector<HTMLElement>(
            '[role="tab"][aria-selected="true"], .titlebar button, .shell button'
          )
          ?.focus();
    });
  };
  return restore;
}
