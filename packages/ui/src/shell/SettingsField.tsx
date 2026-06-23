import type { AppSettings } from "../settings.js";
import type {
  SettingKey,
  SettingsFieldDefinition
} from "./settingsDefinitions.js";

export type SettingsFieldProps = {
  field: SettingsFieldDefinition;
  settings: AppSettings;
  updateSetting: (key: SettingKey, value: AppSettings[SettingKey]) => void;
};

export function SettingsField({
  field,
  settings,
  updateSetting
}: SettingsFieldProps) {
  if (field.kind === "checkbox") {
    return (
      <label className="settings-row settings-row-checkbox">
        <span>
          <strong>{field.title}</strong>
          <small>{field.description}</small>
        </span>
        <input
          checked={Boolean(settings[field.key])}
          onChange={(event) => updateSetting(field.key, event.target.checked)}
          type="checkbox"
        />
      </label>
    );
  }

  return (
    <label className="settings-row">
      <span>
        <strong>{field.title}</strong>
        <small>{field.description}</small>
      </span>
      <select
        onChange={(event) =>
          updateSetting(
            field.key,
            (field.valueType === "number"
              ? Number(event.target.value)
              : event.target.value) as AppSettings[SettingKey]
          )
        }
        value={settings[field.key] as number | string}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
