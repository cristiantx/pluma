import { Allotment } from "allotment";
import type { ReactNode } from "react";

type PaneProps = {
  children: ReactNode;
  minSize?: number;
  preferredSize?: number | string;
  visible?: boolean;
};

type PaneLayoutProps = {
  main: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
};

export function Pane({ children, minSize, preferredSize, visible }: PaneProps) {
  return (
    <Allotment.Pane
      {...(minSize !== undefined ? { minSize } : {})}
      {...(preferredSize !== undefined ? { preferredSize } : {})}
      {...(visible !== undefined ? { visible } : {})}
    >
      {children}
    </Allotment.Pane>
  );
}

export function PaneLayout({ main, primary, secondary }: PaneLayoutProps) {
  return (
    <Allotment className="pane-layout">
      <Pane minSize={160} preferredSize={178}>
        {primary}
      </Pane>
      <Pane minSize={420}>{main}</Pane>
      {secondary ? (
        <Pane minSize={200} preferredSize={260}>
          {secondary}
        </Pane>
      ) : null}
    </Allotment>
  );
}
