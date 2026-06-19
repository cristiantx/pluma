import { Allotment } from "allotment";
import type { ReactNode } from "react";

type EditorPaneLayoutProps = {
  onPaneSizesChange: (sizes: number[]) => void;
  paneSizes?: number[];
  rich: ReactNode;
  source: ReactNode;
  splitViewOrder: "rich-source" | "source-rich";
};

export function EditorPaneLayout({
  onPaneSizesChange,
  paneSizes,
  rich,
  source,
  splitViewOrder
}: EditorPaneLayoutProps) {
  const leftPane = splitViewOrder === "source-rich" ? source : rich;
  const rightPane = splitViewOrder === "source-rich" ? rich : source;

  return (
    <Allotment
      className="editor-pane-layout"
      defaultSizes={paneSizes ?? [50, 50]}
      onChange={onPaneSizesChange}
      proportionalLayout
      vertical={false}
    >
      <Allotment.Pane minSize={280}>{leftPane}</Allotment.Pane>
      <Allotment.Pane minSize={280}>{rightPane}</Allotment.Pane>
    </Allotment>
  );
}
