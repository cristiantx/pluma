import { useEffect, useState } from "react";
import {
  initialShellState,
  reduceShellEvent,
  type CommandName
} from "./shell-state";
import { ThemePicker } from "./theme-picker";
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

  useEffect(() => {
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
    void window.pluma.runCommand(command);
  };

  return (
    <main className="shell" data-theme={resolvedTheme}>
      <header className="command-bar">
        <div className="command-group">
          <span className="app-badge">Pluma Desktop</span>
          <button onClick={() => runCommand("open-file")} type="button">
            Open File
          </button>
          <button onClick={() => runCommand("open-folder")} type="button">
            Open Folder
          </button>
          <button onClick={() => runCommand("save")} type="button">
            Save
          </button>
        </div>
        <div className="command-group command-group-end">
          <ThemePicker
            onChange={setThemePreference}
            preference={themePreference}
            resolvedTheme={resolvedTheme}
          />
          <button onClick={() => runCommand("toggle-mode")} type="button">
            Toggle {state.mode === "rich" ? "Source" : "Rich"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Phase 1 desktop shell</p>
          <h1>Pluma</h1>
          <p className="lede">
            Electron Forge, Vite, React, Radix Primitives, and a secure preload
            bridge are wired. The document model and filesystem adapter come
            next.
          </p>
        </div>
        <div className="mode-card">
          <span className="mode-label">Editor Mode</span>
          <strong>{state.mode === "rich" ? "Rich" : "Source"}</strong>
          <span className="mode-detail">
            Theme preference: {themePreference} / resolved: {resolvedTheme}
          </span>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <header>
            <h2>Shell Actions</h2>
            <p>
              These commands are live through the preload-only IPC surface and
              the shell now carries semantic light and dark themes.
            </p>
          </header>
          <div className="actions">
            <button onClick={() => runCommand("save-as")} type="button">
              Save As
            </button>
            <button onClick={() => setThemePreference("system")} type="button">
              Follow System Theme
            </button>
            <button onClick={() => setThemePreference("dark")} type="button">
              Force Dark Theme
            </button>
          </div>
        </article>

        <article className="panel">
          <header>
            <h2>Current Selection</h2>
            <p>
              Phase 1 stops at the shell boundary. No file contents are loaded
              yet.
            </p>
          </header>
          <dl className="facts">
            <div>
              <dt>Active file</dt>
              <dd>{state.activeFile ?? "None"}</dd>
            </div>
            <div>
              <dt>Active folder</dt>
              <dd>{state.activeFolder ?? "None"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{state.status}</dd>
            </div>
            <div>
              <dt>Theme</dt>
              <dd>
                Preference: {themePreference} | Active: {resolvedTheme}
              </dd>
            </div>
          </dl>
        </article>

        <article className="panel activity-panel">
          <header>
            <h2>Recent Activity</h2>
            <p>Menu commands and renderer actions both land here.</p>
          </header>
          <ul>
            {state.activity.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
