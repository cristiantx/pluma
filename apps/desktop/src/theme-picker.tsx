import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import type { ThemePreference } from "./theme";

type ThemePickerProps = {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  onChange: (preference: ThemePreference) => void;
};

const themeLabels: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark"
};

export function ThemePicker({
  preference,
  resolvedTheme,
  onChange
}: ThemePickerProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="menu-trigger" type="button">
          Theme: {themeLabels[preference]}
          <span className="menu-trigger-detail">{resolvedTheme}</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="dropdown-content"
          sideOffset={8}
        >
          <DropdownMenu.Label className="dropdown-label">
            Appearance
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="dropdown-separator" />
          <DropdownMenu.RadioGroup
            onValueChange={(value) => onChange(value as ThemePreference)}
            value={preference}
          >
            {(["system", "light", "dark"] as const).map((option) => (
              <DropdownMenu.RadioItem
                className="dropdown-item"
                key={option}
                value={option}
              >
                <DropdownMenu.ItemIndicator className="dropdown-indicator">
                  <span aria-hidden="true">•</span>
                </DropdownMenu.ItemIndicator>
                <span>{themeLabels[option]}</span>
                {option === "system" ? (
                  <span className="dropdown-shortcut">Auto</span>
                ) : null}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="dropdown-separator" />
          <DropdownMenu.Item className="dropdown-note" disabled>
            Resolved: {resolvedTheme}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
