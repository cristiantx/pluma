import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";

export const StatusBar = memo(function StatusBar() {
  const metrics = usePlumaStore((state) => state.status.statusMetrics);

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
        <span className="statusbar-filetype">Markdown</span>
      </div>
    </footer>
  );
});
