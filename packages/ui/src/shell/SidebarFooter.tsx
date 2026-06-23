import { Settings } from "lucide-react";
import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";

export const SidebarFooter = memo(function SidebarFooter() {
  const openSettingsTab = usePlumaStore((state) => state.openSettingsTab);

  return (
    <footer className="sidebar-footer">
      <button
        className="sidebar-settings-button"
        onClick={openSettingsTab}
        type="button"
      >
        <Settings aria-hidden="true" />
        <span>Settings</span>
      </button>
    </footer>
  );
});
