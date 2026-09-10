import { Allotment } from "allotment";
import { useState, type ReactNode } from "react";

import { usePrimaryPaneMotion } from "./usePrimaryPaneMotion.js";

export type PaneLayoutProps = {
  main: ReactNode;
  onPaneSizesChange?: (sizes: number[]) => void;
  paneSizes?: number[];
  primary: ReactNode;
  primaryToggle?: ReactNode;
  primaryVisible?: boolean;
  secondary?: ReactNode;
};

export function PaneLayout({
  main,
  onPaneSizesChange,
  paneSizes,
  primary,
  primaryToggle,
  primaryVisible = true,
  secondary
}: PaneLayoutProps) {
  const [initialSizes] = useState(() => {
    const defaults = secondary ? [220, 800, 260] : [220, 800];
    return paneSizes?.length === defaults.length ? paneSizes : defaults;
  });
  const motion = usePrimaryPaneMotion({
    visible: primaryVisible,
    initialSizes,
    onPaneSizesChange
  });
  const [defaultSizes] = useState(() =>
    primaryVisible
      ? initialSizes
      : [
          0,
          (initialSizes[0] ?? 220) + (initialSizes[1] ?? 800),
          ...initialSizes.slice(2)
        ]
  );

  return (
    <div
      className="pane-layout"
      data-primary-animating={motion.animating}
      data-primary-visible={primaryVisible}
      ref={motion.containerRef}
    >
      <Allotment
        ref={motion.layoutRef}
        defaultSizes={defaultSizes}
        onChange={motion.onChange}
        vertical={false}
        separator={false}
      >
        <Allotment.Pane
          className="primary"
          ref={motion.primaryRef}
          minSize={0}
          preferredSize={220}
        >
          <div
            className="primary-slide"
            ref={motion.slideRef}
            inert={!primaryVisible}
            aria-hidden={!primaryVisible}
          >
            {primary}
          </div>
        </Allotment.Pane>
        <Allotment.Pane className="main" minSize={420}>
          {main}
        </Allotment.Pane>
        {secondary ? (
          <Allotment.Pane
            className="secondary"
            minSize={200}
            preferredSize={260}
          >
            {secondary}
          </Allotment.Pane>
        ) : null}
      </Allotment>
      {primaryToggle}
    </div>
  );
}
