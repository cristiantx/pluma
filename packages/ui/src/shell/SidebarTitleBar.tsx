import { FolderTree, PanelLeft, Search } from "lucide-react";
import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { TitleBarButton } from "./TitleBarButton.js";

export const SidebarTitleBar = memo(function SidebarTitleBar() {
  const sidebarView = usePlumaStore((state) => state.workspace.sidebarView);
  const setSidebarView = usePlumaStore((state) => state.setSidebarView);
  const toggleSidebar = usePlumaStore((state) => state.toggleSidebar);
  const isSearchView = sidebarView === "search";
  const SidebarViewIcon = isSearchView ? FolderTree : Search;

  return (
    <header className="sidebar-titlebar" aria-label="Sidebar controls">
      <div className="sidebar-window-control-spacer" aria-hidden="true" />
      <TitleBarButton
        aria-label={isSearchView ? "Show files" : "Search workspace"}
        className="sidebar-titlebar-view-toggle"
        icon={SidebarViewIcon}
        isPressed={isSearchView}
        onClick={() => setSidebarView(isSearchView ? "workspace" : "search")}
      />
      <TitleBarButton
        aria-label="Hide sidebar"
        className="sidebar-titlebar-toggle"
        icon={PanelLeft}
        isPressed
        onClick={toggleSidebar}
      />
    </header>
  );
});
