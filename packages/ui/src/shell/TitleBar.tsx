import { Bug, PanelLeft } from "lucide-react";
import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { PlumaLogo } from "./PlumaLogo.js";
import { TitleBarButton } from "./TitleBarButton.js";

export const TitleBar = memo(function TitleBar() {
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);
  const isBridgeAvailable = usePlumaStore(
    (state) => state.workspace.isBridgeAvailable
  );
  const isDevelopment = usePlumaStore((state) => state.workspace.isDevelopment);
  const workspaceLabel = usePlumaStore(
    (state) => state.workspace.workspaceLabel
  );
  const isSidebarVisible = usePlumaStore(
    (state) => state.layout.isSidebarVisible
  );
  const triggerOpenDevTools = usePlumaStore(
    (state) => state.triggerOpenDevTools
  );
  const toggleSidebar = usePlumaStore((state) => state.toggleSidebar);
  const shouldShowSidebarRestore = hasWorkspace && !isSidebarVisible;

  return (
    <header className={`titlebar ${hasWorkspace ? "with-workspace" : ""}`}>
      {shouldShowSidebarRestore ? (
        <TitleBarButton
          aria-label="Show sidebar"
          className="titlebar-sidebar-toggle"
          icon={PanelLeft}
          onClick={toggleSidebar}
        />
      ) : null}

      {hasWorkspace ? (
        <div className="titlebar-path">
          <span>{workspaceLabel}</span>
        </div>
      ) : (
        <div className="titlebar-brand">
          <PlumaLogo />
          <span>Pluma</span>
        </div>
      )}

      <div className="titlebar-actions">
        {!isBridgeAvailable ? (
          <span className="bridge-warning">Offline</span>
        ) : null}
        {isDevelopment ? (
          <TitleBarButton
            aria-label="Open DevTools"
            icon={Bug}
            onClick={triggerOpenDevTools}
          />
        ) : null}
      </div>
    </header>
  );
});
