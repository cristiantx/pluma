import { memo } from "react";

import type { EditorViewMode } from "../state/plumaStoreTypes.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

const editorViewModes: { label: string; mode: EditorViewMode }[] = [
  { label: "Source", mode: "source" },
  { label: "Split", mode: "split" },
  { label: "Rich", mode: "rich" }
];

export const StatusBar = memo(function StatusBar() {
  const editorViewMode = usePlumaStore((state) => state.layout.editorViewMode);
  const metrics = usePlumaStore((state) => state.status.statusMetrics);
  const setEditorViewMode = usePlumaStore((state) => state.setEditorViewMode);

  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        {metrics.map((metric) => (
          <span className="status-metric" key={metric.label}>
            <span className="status-metric-label">{metric.label}</span>
            <span className="status-metric-value">{metric.value}</span>
          </span>
        ))}
      </div>
      <div className="statusbar-group">
        <div className="statusbar-view-switch" aria-label="Editor view mode">
          {editorViewModes.map((item) => (
            <button
              aria-pressed={editorViewMode === item.mode}
              className="statusbar-view-switch-button"
              key={item.mode}
              onClick={() => setEditorViewMode(item.mode)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
});
