import { Allotment } from "allotment";
import type { ReactNode } from "react";

type EditorPaneLayoutProps = {
  onPaneSizesChange: (sizes: number[]) => void;
  paneSizes?: number[];
  rich: ReactNode;
  source: ReactNode;
};

export function EditorPaneLayout({
  onPaneSizesChange,
  paneSizes,
  rich,
  source
}: EditorPaneLayoutProps) {
  return (
    <Allotment
      className="editor-pane-layout"
      defaultSizes={paneSizes ?? [50, 50]}
      onChange={onPaneSizesChange}
      proportionalLayout
      vertical={false}
    >
      <Allotment.Pane minSize={280}>{rich}</Allotment.Pane>
      <Allotment.Pane minSize={280}>{source}</Allotment.Pane>
    </Allotment>
  );
}
