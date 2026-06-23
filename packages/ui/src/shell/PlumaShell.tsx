import { useMemo } from "react";

import { PaneLayout } from "../panes/PaneLayout.js";
import { usePlumaStore } from "../state/usePlumaStore.js";
import { MainShellPanel } from "./MainShellPanel.js";
import { Sidebar } from "./Sidebar.js";

export function PlumaShell() {
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const isSidebarVisible = usePlumaStore(
    (state) => state.layout.isSidebarVisible
  );
  const paneSizes = usePlumaStore((state) => state.layout.paneSizes);
  const updatePaneSizes = usePlumaStore((state) => state.updatePaneSizes);
  const mainPane = useMemo(() => <MainShellPanel />, []);
  const primaryPane = useMemo(() => <Sidebar />, []);

  return (
    <main
      className="shell"
      data-sidebar-visible={hasWorkspace && isSidebarVisible}
      data-theme={resolvedTheme}
    >
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
    </main>
  );
}
