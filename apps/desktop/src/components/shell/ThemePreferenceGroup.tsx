import type { ThemePreference } from "../../theme";

type ThemePreferenceGroupProps = {
  onChange: (preference: ThemePreference) => void;
  preference: ThemePreference;
};

const themeOptions: ThemePreference[] = ["system", "light", "dark"];

export function ThemePreferenceGroup({
  onChange,
  preference
}: ThemePreferenceGroupProps) {
  return (
    <div
      aria-label="Theme preference"
      className="theme-preference-group"
      role="group"
    >
      {themeOptions.map((option) => (
        <button
          aria-pressed={preference === option}
          className={
            preference === option
              ? "theme-preference-button is-active"
              : "theme-preference-button"
          }
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
