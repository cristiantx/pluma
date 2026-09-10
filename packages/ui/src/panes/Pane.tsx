import { Allotment } from "allotment";
import type { ReactNode } from "react";

type PaneProps = {
  children: ReactNode;
  minSize?: number;
  preferredSize?: number | string;
  visible?: boolean;
  className?: string;
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
