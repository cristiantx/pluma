import type { ChangeEvent } from "react";

import { formatLineEndingLabel } from "@pluma/core";

import type { AppSettings } from "../settings.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

type SettingKey = keyof AppSettings;

const widthOptions = [
  ["narrow", "Narrow"],
  ["default", "Default"],
  ["wide", "Wide"],
  ["full", "Full"]
] as const;

export function SettingsView() {
  const settings = usePlumaStore((state) => state.settings);
  const activeDocument = usePlumaStore(
    (state) => state.document.activeDocument
  );
  const convertLineEndings = usePlumaStore((state) => state.convertLineEndings);
  const updateSettings = usePlumaStore((state) => state.updateSettings);

  const updateBooleanSetting =
    (key: SettingKey) => (event: ChangeEvent<HTMLInputElement>) => {
      void updateSettings({ [key]: event.target.checked });
    };
  const updateStringSetting =
    (key: SettingKey) => (event: ChangeEvent<HTMLSelectElement>) => {
      void updateSettings({ [key]: event.target.value });
    };
  const updateNumberSetting =
    (key: SettingKey) => (event: ChangeEvent<HTMLSelectElement>) => {
      void updateSettings({ [key]: Number(event.target.value) });
    };

  return (
    <section className="settings-view" aria-label="Settings">
      <header className="settings-header">
        <h1>Settings</h1>
      </header>

      <div className="settings-sections">
        <section
          className="settings-section"
          aria-labelledby="settings-general"
        >
          <h2 id="settings-general">General</h2>
          <label className="settings-row">
            <span>
              <strong>Theme</strong>
              <small>Use the system theme or pin Pluma to light or dark.</small>
            </span>
            <select
              onChange={updateStringSetting("themePreference")}
              value={settings.themePreference}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <div className="settings-row">
            <span>
              <strong>Current document line endings</strong>
              <small>
                {activeDocument
                  ? formatLineEndingLabel(activeDocument.lineEnding)
                  : "No active document"}
              </small>
            </span>
            <div className="settings-inline-actions">
              <button
                disabled={!activeDocument}
                onClick={() => convertLineEndings("lf")}
                type="button"
              >
                Convert To LF
              </button>
              <button
                disabled={!activeDocument}
                onClick={() => convertLineEndings("crlf")}
                type="button"
              >
                Convert To CRLF
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-editor">
          <h2 id="settings-editor">Editor</h2>
          <label className="settings-row">
            <span>
              <strong>Rich editor width</strong>
              <small>Controls the maximum prose column width.</small>
            </span>
            <select
              onChange={updateStringSetting("richEditorWidth")}
              value={settings.richEditorWidth}
            >
              {widthOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span>
              <strong>Source editor width</strong>
              <small>Controls the maximum Markdown source column width.</small>
            </span>
            <select
              onChange={updateStringSetting("sourceEditorWidth")}
              value={settings.sourceEditorWidth}
            >
              {widthOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span>
              <strong>Source font size</strong>
              <small>Adjusts Markdown source text and gutters.</small>
            </span>
            <select
              onChange={updateNumberSetting("sourceEditorFontSize")}
              value={settings.sourceEditorFontSize}
            >
              {[12, 13, 14, 15, 16, 18].map((value) => (
                <option key={value} value={value}>
                  {value}px
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span>
              <strong>Source font family</strong>
              <small>Choose compact monospace or the app UI font.</small>
            </span>
            <select
              onChange={updateStringSetting("sourceEditorFontFamily")}
              value={settings.sourceEditorFontFamily}
            >
              <option value="mono">Monospace</option>
              <option value="system">System UI</option>
            </select>
          </label>
          <label className="settings-row settings-row-checkbox">
            <span>
              <strong>Source word wrap</strong>
              <small>Wrap long Markdown lines inside the source editor.</small>
            </span>
            <input
              checked={settings.sourceEditorWordWrap}
              onChange={updateBooleanSetting("sourceEditorWordWrap")}
              type="checkbox"
            />
          </label>
          <label className="settings-row settings-row-checkbox">
            <span>
              <strong>Source line numbers</strong>
              <small>Show line numbers in the source editor gutter.</small>
            </span>
            <input
              checked={settings.sourceEditorLineNumbers}
              onChange={updateBooleanSetting("sourceEditorLineNumbers")}
              type="checkbox"
            />
          </label>
          <label className="settings-row">
            <span>
              <strong>Source tab size</strong>
              <small>Controls rendered tab width and indentation units.</small>
            </span>
            <select
              onChange={updateNumberSetting("sourceEditorTabSize")}
              value={settings.sourceEditorTabSize}
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
            </select>
          </label>
          <label className="settings-row">
            <span>
              <strong>Rich editor density</strong>
              <small>
                Compact mode reduces prose padding and vertical rhythm.
              </small>
            </span>
            <select
              onChange={updateStringSetting("richEditorDensity")}
              value={settings.richEditorDensity}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className="settings-row">
            <span>
              <strong>Split view order</strong>
              <small>Choose which editor appears on the left.</small>
            </span>
            <select
              onChange={updateStringSetting("splitViewOrder")}
              value={settings.splitViewOrder}
            >
              <option value="rich-source">Rich left, source right</option>
              <option value="source-rich">Source left, rich right</option>
            </select>
          </label>
        </section>

        <section className="settings-section" aria-labelledby="settings-files">
          <h2 id="settings-files">Files And Saving</h2>
          <label className="settings-row settings-row-checkbox">
            <span>
              <strong>Auto Save</strong>
              <small>Save dirty desktop files after a short pause.</small>
            </span>
            <input
              checked={settings.autosaveEnabled}
              onChange={updateBooleanSetting("autosaveEnabled")}
              type="checkbox"
            />
          </label>
          <label className="settings-row settings-row-checkbox">
            <span>
              <strong>Check spelling while typing</strong>
              <small>Applies to rich and source editor text surfaces.</small>
            </span>
            <input
              checked={settings.spellcheckEnabled}
              onChange={updateBooleanSetting("spellcheckEnabled")}
              type="checkbox"
            />
          </label>
          <label className="settings-row">
            <span>
              <strong>Default line ending</strong>
              <small>
                Used for new files; existing files keep their format.
              </small>
            </span>
            <select
              onChange={updateStringSetting("defaultLineEnding")}
              value={settings.defaultLineEnding}
            >
              <option value="system">System default</option>
              <option value="lf">LF</option>
              <option value="crlf">CRLF</option>
            </select>
          </label>
        </section>
      </div>
    </section>
  );
}
