import { useEffect, useState } from "react";
import {
  initialShellState,
  reduceShellEvent,
  type CommandName
} from "./shell-state";
import {
  extractLeafName,
  getSidebarEntries,
  getStatusMetrics,
  getWorkspaceLabel
} from "./shell-view";
import {
  THEME_STORAGE_KEY,
  readStoredThemePreference,
  resolveThemePreference,
  type ThemePreference
} from "./theme";

export function App() {
  const [state, setState] = useState(initialShellState);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);

  useEffect(() => {
    if (!window.pluma) {
      setState((current) => ({
        ...current,
        status:
          "Renderer loaded without preload bridge. Shell commands are unavailable."
      }));
      return;
    }

    setBridgeAvailable(true);

    return window.pluma.onEvent((event) => {
      setState((current) => reduceShellEvent(current, event));
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    setSystemPrefersDark(mediaQuery.matches);
    setThemePreference(
      readStoredThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
    );

    mediaQuery.addEventListener("change", onChange);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  const resolvedTheme = resolveThemePreference(
    themePreference,
    systemPrefersDark
  );

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

  const runCommand = (command: CommandName) => {
    if (!window.pluma) {
      setState((current) => ({
        ...current,
        status: `Cannot run "${command}" because the preload bridge is unavailable.`
      }));
      return;
    }

    void window.pluma.runCommand(command);
  };

  const workspaceLabel = getWorkspaceLabel(state);
  const sidebarEntries = getSidebarEntries(state);
  const statusMetrics = getStatusMetrics(state);
  const activeFileLabel =
    extractLeafName(state.activeFile) ?? "No file selected";
  const themeOptions: ThemePreference[] = ["system", "light", "dark"];

  return (
    <main className="shell" data-theme={resolvedTheme}>
      <header className="titlebar">
        <div className="titlebar-left">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div className="titlebar-copy">
            <span className="window-title">Pluma</span>
            <span className="workspace-title">{workspaceLabel}</span>
          </div>
        </div>
        <div className="titlebar-center">
          <button
            className="titlebar-action"
            onClick={() => runCommand("open-file")}
            type="button"
          >
            Open File
          </button>
          <button
            className="titlebar-action"
            onClick={() => runCommand("open-folder")}
            type="button"
          >
            Open Folder
          </button>
          <button
            className="titlebar-action"
            onClick={() => runCommand("save")}
            type="button"
          >
            Save
          </button>
        </div>
        <div className="titlebar-right">
          {!bridgeAvailable ? (
            <span className="bridge-warning">IPC offline</span>
          ) : null}
          <div className="theme-switcher" role="group" aria-label="Theme mode">
            {themeOptions.map((option) => (
              <button
                aria-pressed={themePreference === option}
                className={
                  themePreference === option
                    ? "theme-switcher-button is-selected"
                    : "theme-switcher-button"
                }
                key={option}
                onClick={() => setThemePreference(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            onClick={() => runCommand("toggle-mode")}
            type="button"
          >
            {state.mode === "rich" ? "Source" : "Rich"}
          </button>
          <button className="icon-button" type="button">
            Search
          </button>
          <button className="icon-button" type="button">
            More
          </button>
        </div>
      </header>

      <div className="workspace-shell">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="section-heading">
              <span>Explorer</span>
              <span className="section-meta">Phase 1.1</span>
            </div>
            <ul className="tree-list">
              {sidebarEntries.map((entry, index) => (
                <li
                  className={
                    index === sidebarEntries.length - 1 ? "is-active" : ""
                  }
                  key={entry}
                >
                  <button className="tree-item" type="button">
                    <span className="tree-bullet" aria-hidden="true">
                      {entry.endsWith("/") ? "▸" : "•"}
                    </span>
                    <span>{entry}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-section">
            <div className="section-heading">
              <span>Outline</span>
              <span className="section-meta">Preview</span>
            </div>
            <ul className="outline-list">
              <li>Heading structure arrives with the real editor.</li>
              <li>Warnings and raw-block regions will surface here later.</li>
            </ul>
          </div>
        </aside>

        <section className="editor-stage">
          <div className="editor-stage-header">
            <div>
              <p className="eyebrow">Current document</p>
              <h1>{activeFileLabel}</h1>
            </div>
            <div className="stage-actions">
              <button onClick={() => runCommand("save-as")} type="button">
                Save As
              </button>
              <button
                onClick={() => setThemePreference("system")}
                type="button"
              >
                Follow System
              </button>
            </div>
          </div>

          <div className="editor-canvas">
            <div className="editor-empty-state">
              <p className="eyebrow">Design foundation</p>
              <h2>VS Code-inspired shell, tuned for writing</h2>
              <p className="lede">
                The shell now defines title-bar hierarchy, sidebar density,
                editor-stage rhythm, and a bottom status system. The actual
                document model, tree data, and metrics come in later phases.
              </p>
            </div>

            <div className="callout-row">
              <article className="callout">
                <span className="mode-label">Workspace</span>
                <strong>{workspaceLabel}</strong>
                <p>
                  {state.activeFolder ??
                    "Open a folder to populate the sidebar."}
                </p>
              </article>
              <article className="callout">
                <span className="mode-label">Status</span>
                <strong>{state.status}</strong>
                <p>
                  Shell commands and theme changes already flow through the UI.
                </p>
              </article>
            </div>
          </div>
        </section>

        <aside className="inspector">
          <div className="sidebar-section">
            <div className="section-heading">
              <span>Properties</span>
              <span className="section-meta">{state.mode}</span>
            </div>
            <dl className="facts">
              <div>
                <dt>Theme preference</dt>
                <dd>{themePreference}</dd>
              </div>
              <div>
                <dt>Resolved theme</dt>
                <dd>{resolvedTheme}</dd>
              </div>
              <div>
                <dt>Active file</dt>
                <dd>{state.activeFile ?? "None"}</dd>
              </div>
              <div>
                <dt>Active folder</dt>
                <dd>{state.activeFolder ?? "None"}</dd>
              </div>
            </dl>
          </div>

          <div className="sidebar-section activity-panel">
            <div className="section-heading">
              <span>Recent activity</span>
              <span className="section-meta">{state.activity.length}</span>
            </div>
            <ul>
              {state.activity.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <footer className="statusbar">
        <div className="statusbar-group">
          {statusMetrics.map((metric) => (
            <div className="status-metric" key={metric.label}>
              <span className="status-label">{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <div className="statusbar-group statusbar-group-end">
          <span>{workspaceLabel}</span>
          <span>{resolvedTheme}</span>
        </div>
      </footer>
    </main>
  );
}
