import type { AllotmentHandle } from "allotment";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const primaryMinimum = 200;
const mainMinimum = 420;

type PrimaryPaneMotionOptions = {
  visible: boolean;
  initialSizes: number[];
  onPaneSizesChange: ((sizes: number[]) => void) | undefined;
};

export function usePrimaryPaneMotion({
  visible,
  initialSizes,
  onPaneSizesChange
}: PrimaryPaneMotionOptions) {
  const layoutRef = useRef<AllotmentHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);
  const motion = useRef({
    initialized: false,
    visible,
    running: false,
    programmatic: false,
    expandedWidth: Math.max(primaryMinimum, initialSizes[0] ?? 220),
    sizes: initialSizes,
    onPaneSizesChange
  });

  useLayoutEffect(() => {
    motion.current.onPaneSizesChange = onPaneSizesChange;
  }, [onPaneSizesChange]);

  const onChange = useCallback((sizes: number[]) => {
    const state = motion.current;
    state.sizes = sizes;
    containerRef.current?.style.setProperty(
      "--primary-pane-width",
      `${sizes[0] ?? 0}px`
    );
    if (
      !state.initialized ||
      state.running ||
      state.programmatic ||
      !state.visible
    )
      return;
    // Keep Allotment constraints static: its StrictMode setup retains stale pane
    // descriptors when minSize/maxSize props change. Enforce the resting minimum
    // here, outside programmatic motion, so dragging still stops at 200px.
    if ((sizes[0] ?? 0) < primaryMinimum) {
      const corrected = [...sizes];
      const delta = primaryMinimum - (sizes[0] ?? 0);
      corrected[0] = primaryMinimum;
      corrected[1] = Math.max(mainMinimum, (sizes[1] ?? mainMinimum) - delta);
      state.programmatic = true;
      layoutRef.current?.resize(corrected);
      state.programmatic = false;
      sizes = state.sizes;
    }
    state.expandedWidth = Math.max(primaryMinimum, sizes[0] ?? primaryMinimum);
    if (slideRef.current) {
      slideRef.current.style.width = "100%";
      slideRef.current.style.transform = "";
    }
    state.onPaneSizesChange?.(sizes);
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const primary = primaryRef.current;
    const slide = slideRef.current;
    if (!container || !primary || !slide) return;
    const state = motion.current;
    const changed = state.initialized && state.visible !== visible;
    const firstLayout = !state.initialized;
    state.initialized = true;
    state.visible = visible;
    let frame = 0;
    let disposed = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const startWidth = primary.getBoundingClientRect().width;
    if (changed && !visible && !state.running) {
      state.expandedWidth = Math.max(primaryMinimum, startWidth);
    }
    let startedAt: number | undefined;

    function targetWidth() {
      const remaining = state.sizes
        .slice(2)
        .reduce((sum, size) => sum + size, 0);
      return Math.max(
        0,
        Math.min(
          state.expandedWidth,
          container!.clientWidth - mainMinimum - remaining
        )
      );
    }

    function resize(width: number, expandedWidth: number) {
      const remaining = state.sizes.slice(2);
      const mainWidth =
        container!.clientWidth -
        width -
        remaining.reduce((sum, size) => sum + size, 0);
      state.programmatic = true;
      layoutRef.current?.resize([width, mainWidth, ...remaining]);
      state.programmatic = false;
      // Keep the sidebar's text at its expanded width while sliding it out.
      slide!.style.width = `${expandedWidth}px`;
      slide!.style.transform = `translateX(${Math.min(0, width - expandedWidth)}px)`;
    }

    function finish() {
      resize(visible ? targetWidth() : 0, targetWidth());
      state.running = false;
      if (visible) {
        slide!.style.width = "100%";
        slide!.style.transform = "";
      }
      setAnimating(false);
    }

    function tick(now: number) {
      if (disposed) return;
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / (visible ? 240 : 180));
      // Ease-out-quart; continue from the current geometry on reversals.
      const eased = 1 - (1 - progress) ** 4;
      const expandedWidth = targetWidth();
      resize(
        startWidth + ((visible ? expandedWidth : 0) - startWidth) * eased,
        expandedWidth
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    }

    function settleImmediately() {
      cancelAnimationFrame(frame);
      finish();
    }

    if (changed && !reducedMotion.matches) {
      state.running = true;
      setAnimating(true);
      resize(startWidth, targetWidth());
      frame = requestAnimationFrame(tick);
    } else if (changed || firstLayout) {
      finish();
    }

    const observer = new ResizeObserver(() => {
      if (!state.running && !state.visible) resize(0, targetWidth());
    });
    observer.observe(container);
    reducedMotion.addEventListener("change", settleImmediately);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reducedMotion.removeEventListener("change", settleImmediately);
    };
  }, [visible]);

  return {
    layoutRef,
    containerRef,
    primaryRef,
    slideRef,
    onChange,
    animating
  };
}
