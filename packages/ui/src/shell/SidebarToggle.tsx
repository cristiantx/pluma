import { PanelLeft } from "lucide-react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { TitleBarButton } from "./TitleBarButton.js";

export function SidebarToggle() {
  const isSidebarVisible = usePlumaStore(
    (state) => state.layout.isSidebarVisible
  );
  const toggleSidebar = usePlumaStore((state) => state.toggleSidebar);

  return (
    <TitleBarButton
      aria-label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
      className="sidebar-toggle"
      icon={PanelLeft}
      isPressed={isSidebarVisible}
      onClick={toggleSidebar}
    />
  );
}
