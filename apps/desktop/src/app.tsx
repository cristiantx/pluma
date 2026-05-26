import { useEffect, useState } from "react";
import {
  initialShellState,
  reduceShellEvent,
  type CommandName
} from "./shell-state";

export function App() {
  const [state, setState] = useState(initialShellState);

  useEffect(() => {
    return window.pluma.onEvent((event) => {
      setState((current) => reduceShellEvent(current, event));
    });
  }, []);

  const runCommand = (command: CommandName) => {
    void window.pluma.runCommand(command);
  };

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Phase 1 desktop shell</p>
          <h1>Pluma</h1>
          <p className="lede">
            Electron Forge, Vite, React, and a secure preload bridge are wired.
            The document model and filesystem adapter come next.
          </p>
        </div>
        <div className="mode-card">
          <span className="mode-label">Editor Mode</span>
          <strong>{state.mode === "rich" ? "Rich" : "Source"}</strong>
          <button onClick={() => runCommand("toggle-mode")} type="button">
            Toggle mode
          </button>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <header>
            <h2>Shell Actions</h2>
            <p>These commands are live through the preload-only IPC surface.</p>
          </header>
          <div className="actions">
            <button onClick={() => runCommand("open-file")} type="button">
              Open File
            </button>
            <button onClick={() => runCommand("open-folder")} type="button">
              Open Folder
            </button>
            <button onClick={() => runCommand("save")} type="button">
              Save
            </button>
            <button onClick={() => runCommand("save-as")} type="button">
              Save As
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
