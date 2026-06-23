import type { AppSettings } from "../settings.js";
import { usePlumaStore } from "../state/usePlumaStore.js";
import { SettingsField } from "./SettingsField.js";
import type { SettingKey } from "./settingsDefinitions.js";
import { settingsActions, settingsSections } from "./settingsDefinitions.js";

type SettingsActionHandlers = {
  openAppDataFolder: () => void;
  openSettingsFile: () => void;
  resetSettings: () => void;
};

export function SettingsView() {
  const settings = usePlumaStore((state) => state.settings);
  const openAppDataFolder = usePlumaStore((state) => state.openAppDataFolder);
  const openSettingsFile = usePlumaStore((state) => state.openSettingsFile);
  const resetSettings = usePlumaStore((state) => state.resetSettings);
  const updateSettings = usePlumaStore((state) => state.updateSettings);
  const actionHandlers: SettingsActionHandlers = {
    openAppDataFolder,
    openSettingsFile,
    resetSettings: () => void resetSettings()
  };
  const updateSetting = (key: SettingKey, value: AppSettings[SettingKey]) => {
    void updateSettings({ [key]: value });
  };

  return (
    <section className="settings-view" aria-label="Settings">
      <header className="settings-header">
        <h1>Settings</h1>
      </header>

      <div className="settings-sections">
        {settingsSections.map((section) => (
          <section
            className="settings-section"
            aria-labelledby={section.id}
            key={section.id}
          >
            <h2 id={section.id}>{section.title}</h2>
            {section.fields.map((field) => (
              <SettingsField
                field={field}
                key={field.key}
                settings={settings}
                updateSetting={updateSetting}
              />
            ))}
          </section>
        ))}

        <section
          className="settings-section"
          aria-labelledby="settings-advanced"
        >
          <h2 id="settings-advanced">Advanced</h2>
          {settingsActions.map((action) => (
            <div className="settings-row" key={action.action}>
              <span>
                <strong>{action.title}</strong>
                <small>{action.description}</small>
              </span>
              <div className="settings-inline-actions">
                <button onClick={actionHandlers[action.action]} type="button">
                  {action.buttonLabel}
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
