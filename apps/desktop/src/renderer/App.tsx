import { useCallback, useEffect, useRef, useState } from "react";

import {
  PlumaShell,
  initialPlumaStoreState,
  usePlumaStore
} from "@pluma/ui";
import { initialShellState, reduceShellEvent } from "../shared/shellState";
import { getShellSnapshot } from "./shellView";
import { createPlumaCommandHandlers } from "./plumaCommandHandlers";

export function App() {
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [shellState, setShellState] = useState(initialShellState);
  const themePreference = usePlumaStore((state) => state.theme.preference);
  const lastPersistedThemePreference = useRef(themePreference);
  const paneSizeSaveTimeout = useRef<number | null>(null);
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const hydrateShellSnapshot = usePlumaStore(
    (state) => state.hydrateShellSnapshot
  );
  const setCommandHandlers = usePlumaStore((state) => state.setCommandHandlers);
  const setSystemPrefersDark = usePlumaStore(
    (state) => state.setSystemPrefersDark
  );
  const setSpellcheckEnabled = usePlumaStore(
    (state) => state.setSpellcheckEnabled
  );
  const setThemePreference = usePlumaStore((state) => state.setThemePreference);

  const schedulePaneSizesSave = useCallback((paneSizes: number[]) => {
    if (!window.pluma) {
      return;
    }

    if (paneSizeSaveTimeout.current) {
      window.clearTimeout(paneSizeSaveTimeout.current);
    }

    const nextPaneSizes = [...paneSizes];

    paneSizeSaveTimeout.current = window.setTimeout(() => {
      paneSizeSaveTimeout.current = null;
      void window.pluma.updatePaneSizes(nextPaneSizes);
    }, 250);
  }, []);

  useEffect(() => {
    usePlumaStore.setState({
      ...usePlumaStore.getState(),
      ...initialPlumaStoreState
    });
  }, []);

  useEffect(() => {
    setCommandHandlers(
      createPlumaCommandHandlers({
        schedulePaneSizesSave,
        setShellState
      })
    );

    if (!window.pluma) {
      setShellState((current) => ({
        ...current,
        status: "Renderer loaded without preload bridge."
      }));
      return;
    }

    return window.pluma.onEvent((event) => {
      if (event.type === "editor-command") {
        window.dispatchEvent(
          new CustomEvent("pluma:editor-command", {
            detail: event.command
          })
        );
      }

      if (event.type === "reveal-workspace-file") {
        usePlumaStore.getState().revealWorkspaceFile(event.path);
      }

      if (event.type === "find-in-folder") {
        usePlumaStore.getState().openWorkspaceSearch(event.path);
      }

      if (event.type === "settings-changed") {
        setSpellcheckEnabled(event.spellcheckEnabled);
      }

      setShellState((current) => reduceShellEvent(current, event));
    });
  }, [schedulePaneSizesSave, setCommandHandlers, setSpellcheckEnabled]);

  useEffect(() => {
    return () => {
      if (paneSizeSaveTimeout.current) {
        window.clearTimeout(paneSizeSaveTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    setSystemPrefersDark(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [setSystemPrefersDark]);

  useEffect(() => {
    if (!window.pluma) {
      setSettingsLoaded(true);
      return;
    }

    let isActive = true;

    void window.pluma.getSettings().then((settings) => {
      if (!isActive) {
        return;
      }

      setSpellcheckEnabled(settings.spellcheckEnabled);
      setThemePreference(settings.themePreference);
      lastPersistedThemePreference.current = settings.themePreference;
      setSettingsLoaded(true);
    });

    return () => {
      isActive = false;
    };
  }, [setSpellcheckEnabled, setThemePreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;

    if (!settingsLoaded || !window.pluma) {
      return;
    }

    if (lastPersistedThemePreference.current === themePreference) {
      return;
    }

    lastPersistedThemePreference.current = themePreference;
    void window.pluma.updateSettings({ themePreference });
  }, [resolvedTheme, settingsLoaded, themePreference]);

  useEffect(() => {
    hydrateShellSnapshot(getShellSnapshot(shellState, Boolean(window.pluma)));
  }, [hydrateShellSnapshot, shellState]);

  return <PlumaShell />;
}
