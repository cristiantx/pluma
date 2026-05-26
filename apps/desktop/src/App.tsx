import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { EditorWorkspace } from "./components/shell/EditorWorkspace";
import { Sidebar } from "./components/shell/Sidebar";
import { StatusBar } from "./components/shell/StatusBar";
import { TitleBar } from "./components/shell/TitleBar";
import {
  initialShellState,
  reduceShellEvent,
  type CommandName
} from "./shellState";
import {
  extractLeafName,
  getExplorerNodes,
  getStatusMetrics,
  getWorkspaceLabel
} from "./shellView";
import {
  THEME_STORAGE_KEY,
  readStoredThemePreference,
  resolveThemePreference,
  type ThemePreference
} from "./theme";

function getInitialThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  return readStoredThemePreference(
    window.localStorage.getItem(THEME_STORAGE_KEY)
  );
}

function getInitialSystemPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function App() {
  const [shellState, setShellState] = useState(initialShellState);
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    getInitialThemePreference
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    getInitialSystemPreference
  );
  const [isBridgeAvailable, setIsBridgeAvailable] = useState(false);

  useEffect(() => {
    if (!window.pluma) {
      setShellState((current) => ({
        ...current,
        status: "Renderer loaded without preload bridge."
      }));
      return;
    }

    setIsBridgeAvailable(true);

    return window.pluma.onEvent((event) => {
      setShellState((current) => reduceShellEvent(current, event));
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
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
      setShellState((current) => ({
        ...current,
        status: `Cannot run "${command}" because IPC is unavailable.`
      }));
      return;
    }

    void window.pluma.runCommand(command);
  };

  const workspaceLabel = getWorkspaceLabel(shellState);
  const explorerNodes = getExplorerNodes(shellState);
  const statusMetrics = getStatusMetrics(shellState);
  const activeFileLabel =
    extractLeafName(shellState.activeFile) ?? "Welcome.md";
  const workspacePath = shellState.activeFolder ?? "~/Documents/Pluma Docs";
  const ThemeToggleIcon = resolvedTheme === "dark" ? Sun : Moon;

  return (
    <main className="shell" data-theme={resolvedTheme}>
      <TitleBar
        isBridgeAvailable={isBridgeAvailable}
        onOpenFolder={() => runCommand("open-folder")}
        onToggleMode={() => runCommand("toggle-mode")}
        onToggleTheme={() =>
          setThemePreference(resolvedTheme === "dark" ? "light" : "dark")
        }
        themeToggleIcon={ThemeToggleIcon}
        workspacePath={workspacePath}
      />

      <div className="workspace-shell">
        <Sidebar
          nodes={explorerNodes}
          onOpenFile={() => runCommand("open-file")}
          onOpenFolder={() => runCommand("open-folder")}
          workspaceLabel={workspaceLabel}
        />

        <EditorWorkspace
          activeFileLabel={activeFileLabel}
          onOpenFile={() => runCommand("open-file")}
        />
      </div>

      <StatusBar
        metrics={statusMetrics}
        onThemePreferenceChange={setThemePreference}
        themePreference={themePreference}
      />
    </main>
  );
}
