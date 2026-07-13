import { useCallback, useEffect, useRef, useState } from "react";

import { PlumaShell, initialPlumaStoreState, usePlumaStore } from "@pluma/ui";
import {
  getExplorerNodesFromEntries,
  getShellSnapshot,
  getWorkspaceLabelFromState
} from "./shellView";
import { createPlumaCommandHandlers } from "./plumaCommandHandlers";

const errorStatusPattern =
  /cannot|conflict|could not|deleted|error|fail|ignored|unavailable/i;

export function App() {
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const themePreference = usePlumaStore((state) => state.theme.preference);
  const lastPersistedThemePreference = useRef(themePreference);
  const paneSizeSaveTimeout = useRef<number | null>(null);
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const hydrateShellSnapshot = usePlumaStore(
    (state) => state.hydrateShellSnapshot
  );
  const hydrateEditorViewMode = usePlumaStore(
    (state) => state.hydrateEditorViewMode
  );
  const setCommandHandlers = usePlumaStore((state) => state.setCommandHandlers);
  const hydrateSettings = usePlumaStore((state) => state.hydrateSettings);
  const pushNotification = usePlumaStore((state) => state.pushNotification);
  const setSystemPrefersDark = usePlumaStore(
    (state) => state.setSystemPrefersDark
  );

  const schedulePaneSizesSave = useCallback(
    (paneSizes: number[]) => {
      if (!window.pluma) {
        pushNotification(
          "Cannot save pane sizes because IPC is unavailable.",
          "error"
        );
        return;
      }

      if (paneSizeSaveTimeout.current) {
        window.clearTimeout(paneSizeSaveTimeout.current);
      }

      const nextPaneSizes = [...paneSizes];

      paneSizeSaveTimeout.current = window.setTimeout(() => {
        paneSizeSaveTimeout.current = null;
        void window.pluma
          ?.updatePaneSizes(nextPaneSizes)
          .catch((error: unknown) => {
            pushNotification(
              `Could not save pane sizes: ${getErrorMessage(error)}`,
              "error"
            );
          });
      }, 250);
    },
    [pushNotification]
  );

  useEffect(() => {
    usePlumaStore.setState({
      ...usePlumaStore.getState(),
      ...initialPlumaStoreState
    });
  }, []);

  useEffect(() => {
    setCommandHandlers(createPlumaCommandHandlers({ schedulePaneSizesSave }));

    if (!window.pluma) {
      pushNotification("Renderer loaded without preload bridge.", "error");
      return;
    }

    return window.pluma.onEvent((event) => {
      switch (event.type) {
        case "active-document-changed":
          usePlumaStore
            .getState()
            .hydrateActiveDocumentChange(
              event.activeDocumentId,
              event.activeTabId,
              event.editorViewMode
            );
          return;
        case "document-closed":
          usePlumaStore.getState().hydrateDocumentClosed(event.documentId);
          return;
        case "document-opened":
          usePlumaStore
            .getState()
            .hydrateDocumentOpened(event.document, event.index, event.viewMode);
          return;
        case "document-patched":
          usePlumaStore
            .getState()
            .hydrateDocumentPatch(event.documentId, event.patch);
          return;
        case "document-view-mode-changed":
          usePlumaStore
            .getState()
            .hydrateDocumentViewMode(event.documentId, event.viewMode);
          return;
        case "editor-command":
          window.dispatchEvent(
            new CustomEvent("pluma:editor-command", {
              detail: event.command
            })
          );
          return;
        case "reveal-workspace-file":
          usePlumaStore.getState().revealWorkspaceFile(event.path);
          return;
        case "find-in-folder":
          usePlumaStore.getState().openWorkspaceSearch(event.path);
          return;
        case "open-settings":
          usePlumaStore.getState().openSettingsTab();
          return;
        case "close-settings-tab":
          usePlumaStore.getState().closeSettingsTab();
          return;
        case "settings-changed":
          hydrateSettings(event.settings);
          return;
        case "mode-changed":
          hydrateEditorViewMode(event.mode);
          return;
        case "shell-snapshot":
          hydrateShellSnapshot(
            getShellSnapshot(event.snapshot, Boolean(window.pluma))
          );
          return;
        case "status":
          if (errorStatusPattern.test(event.message)) {
            pushNotification(event.message, "error");
          }
          return;
        case "workspace-changed": {
          const store = usePlumaStore.getState();
          const workspacePath = event.workspacePath ?? "~/Documents/Pluma Docs";
          store.hydrateDesktopWorkspace({
            explorerNodes: getExplorerNodesFromEntries(
              event.workspaceEntries,
              store.document.activeDocument
            ),
            hasWorkspace: Boolean(event.workspacePath),
            workspaceLabel: getWorkspaceLabelFromState(
              event.workspacePath,
              store.document.documents
            ),
            workspacePath
          });
        }
      }
    });
  }, [
    hydrateEditorViewMode,
    hydrateSettings,
    hydrateShellSnapshot,
    pushNotification,
    schedulePaneSizesSave,
    setCommandHandlers
  ]);

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

    void window.pluma
      .getSettings()
      .then((settings) => {
        if (!isActive) {
          return;
        }

        hydrateSettings(settings);
        lastPersistedThemePreference.current = settings.themePreference;
        setSettingsLoaded(true);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setSettingsLoaded(true);
        pushNotification(
          `Could not load settings: ${getErrorMessage(error)}`,
          "error"
        );
      });

    return () => {
      isActive = false;
    };
  }, [hydrateSettings, pushNotification]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;

    if (
      !settingsLoaded ||
      !window.pluma ||
      lastPersistedThemePreference.current === themePreference
    ) {
      return;
    }

    let isActive = true;

    void window.pluma
      .updateSettings({ themePreference })
      .then(() => {
        if (isActive) {
          lastPersistedThemePreference.current = themePreference;
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          pushNotification(
            `Could not save theme preference: ${getErrorMessage(error)}`,
            "error"
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [pushNotification, resolvedTheme, settingsLoaded, themePreference]);

  return <PlumaShell />;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
