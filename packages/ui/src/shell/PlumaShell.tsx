import { useMemo } from "react";

import { PaneLayout } from "../panes/PaneLayout.js";
import { usePlumaStore } from "../state/usePlumaStore.js";
import { EditorWorkspace } from "./EditorWorkspace.js";
import { Sidebar } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { TitleBar } from "./TitleBar.js";

export function PlumaShell() {
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const isSidebarVisible = usePlumaStore(
    (state) => state.layout.isSidebarVisible
  );
  const paneSizes = usePlumaStore((state) => state.layout.paneSizes);
  const updatePaneSizes = usePlumaStore((state) => state.updatePaneSizes);
  const mainPane = useMemo(() => <EditorWorkspace />, []);
  const primaryPane = useMemo(() => <Sidebar />, []);

  return (
    <main className="shell" data-theme={resolvedTheme}>
      <TitleBar />
      <div className="shell-content">
        {hasWorkspace && isSidebarVisible ? (
          <PaneLayout
            main={mainPane}
            onPaneSizesChange={updatePaneSizes}
            paneSizes={paneSizes}
            primary={primaryPane}
          />
        ) : (
          mainPane
        )}
      </div>
      <StatusBar />
    </main>
  );
}
