import { QuickAccess } from "./quickaccess/QuickAccess.js";
import { useMemo, useRef } from "react";

import { PaneLayout } from "../panes/PaneLayout.js";
import { usePlumaStore } from "../state/usePlumaStore.js";
import { MainShellPanel } from "./MainShellPanel.js";
import { NotificationCenter } from "./NotificationCenter.js";
import { Sidebar } from "./Sidebar.js";
import { SidebarToggle } from "./SidebarToggle.js";
import { useSidebarToggleFocus } from "./useSidebarToggleFocus.js";

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

  const shellRef = useRef<HTMLElement>(null);
  useSidebarToggleFocus(shellRef, hasWorkspace && isSidebarVisible);

  return (
    <main
      ref={shellRef}
      className="shell"
      data-sidebar-visible={hasWorkspace && isSidebarVisible}
      data-theme={resolvedTheme}
    >
      {hasWorkspace ? (
        <PaneLayout
          main={mainPane}
          onPaneSizesChange={updatePaneSizes}
          paneSizes={paneSizes}
          primary={primaryPane}
          primaryToggle={<SidebarToggle />}
          primaryVisible={isSidebarVisible}
        />
      ) : (
        mainPane
      )}
      <NotificationCenter />
      <QuickAccess />
    </main>
  );
}
