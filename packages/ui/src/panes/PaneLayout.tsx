import { Allotment } from "allotment";
import type { ReactNode } from "react";

type PaneProps = {
  children: ReactNode;
  minSize?: number;
  preferredSize?: number | string;
  visible?: boolean;
  className?: string;
};

type PaneLayoutProps = {
  main: ReactNode;
  onPaneSizesChange?: (sizes: number[]) => void;
  paneSizes?: number[];
  primary: ReactNode;
  secondary?: ReactNode;
};

export function Pane({
  children,
  minSize,
  preferredSize,
  className,
  visible
}: PaneProps) {
  return (
    <Allotment.Pane
      {...(className !== undefined ? { className } : {})}
      {...(minSize !== undefined ? { minSize } : {})}
      {...(preferredSize !== undefined ? { preferredSize } : {})}
      {...(visible !== undefined ? { visible } : {})}
    >
      {children}
    </Allotment.Pane>
  );
}

export function PaneLayout({
  main,
  onPaneSizesChange,
  paneSizes,
  primary,
  secondary
}: PaneLayoutProps) {
  const defaultSizes = secondary ? [178, 842, 260] : [178, 842];
  const initialSizes =
    paneSizes && paneSizes.length === defaultSizes.length
      ? paneSizes
      : defaultSizes;

  return (
    <Allotment
      className="pane-layout"
      defaultSizes={initialSizes}
      {...(onPaneSizesChange ? { onChange: onPaneSizesChange } : {})}
      vertical={false}
      separator={false}
    >
      <Allotment.Pane className="primary" minSize={200} preferredSize={220}>
        {primary}
      </Allotment.Pane>
      <Allotment.Pane className="main" minSize={420}>
        {main}
      </Allotment.Pane>
      {secondary ? (
        <Allotment.Pane className="secondary" minSize={200} preferredSize={260}>
          {secondary}
        </Allotment.Pane>
      ) : null}
    </Allotment>
  );
}
