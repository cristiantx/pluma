import { useLayoutEffect, useRef, type RefObject } from "react";

export function useSidebarToggleFocus(
  shellRef: RefObject<HTMLElement | null>,
  visible: boolean
) {
  const lastFocused = useRef<Element | null>(null);
  const wasVisible = useRef(visible);

  useLayoutEffect(() => {
    const rememberFocus = () => {
      lastFocused.current = document.activeElement;
    };
    rememberFocus();
    document.addEventListener("focusin", rememberFocus);
    return () => document.removeEventListener("focusin", rememberFocus);
  }, []);

  useLayoutEffect(() => {
    if (wasVisible.current === visible) return;
    wasVisible.current = visible;
    const previous = lastFocused.current;
    const focusWasHidden = !visible && previous?.closest(".sidebar");
    if (focusWasHidden) {
      shellRef.current
        ?.querySelector<HTMLButtonElement>(".sidebar-toggle")
        ?.focus({ preventScroll: true });
    }
  }, [shellRef, visible]);
}
