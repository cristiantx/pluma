import type { StatusMetric } from "../../shellView";
import type { ThemePreference } from "../../theme";
import { ThemePreferenceGroup } from "./ThemePreferenceGroup";

type StatusBarProps = {
  metrics: StatusMetric[];
  onThemePreferenceChange: (preference: ThemePreference) => void;
  themePreference: ThemePreference;
};

export function StatusBar({
  metrics,
  onThemePreferenceChange,
  themePreference
}: StatusBarProps) {
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
        <ThemePreferenceGroup
          onChange={onThemePreferenceChange}
          preference={themePreference}
        />
        <span>Markdown</span>
      </div>
    </footer>
  );
}
