import { usePlumaStore } from "../state/usePlumaStore.js";

export function StatusBar() {
  const metrics = usePlumaStore((state) => state.status.statusMetrics);

  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        {metrics.slice(0, 3).map((metric) => (
          <span className="status-metric" key={metric.label}>
            {metric.label}: {metric.value}
          </span>
        ))}
      </div>
      <div className="statusbar-group">
        <span>Markdown</span>
      </div>
    </footer>
  );
}
