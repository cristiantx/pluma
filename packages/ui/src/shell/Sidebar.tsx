import * as Tooltip from "@radix-ui/react-tooltip";
import { FolderTree, Search } from "lucide-react";
import { memo } from "react";
import type { ComponentType, SVGProps } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import type { SidebarView } from "../state/plumaStoreTypes.js";
import { SidebarTree } from "./SidebarTree.js";
import { WorkspaceSearch } from "./WorkspaceSearch.js";

export const Sidebar = memo(function Sidebar() {
  const nodes = usePlumaStore((state) => state.workspace.explorerNodes);
  const revealRequestId = usePlumaStore(
    (state) => state.workspace.revealRequestId
  );
  const revealWorkspacePath = usePlumaStore(
    (state) => state.workspace.revealWorkspacePath
  );
  const workspaceLabel = usePlumaStore(
    (state) => state.workspace.workspaceLabel
  );
  const sidebarView = usePlumaStore((state) => state.workspace.sidebarView);
  const setSidebarView = usePlumaStore((state) => state.setSidebarView);
  const triggerOpenWorkspaceFile = usePlumaStore(
    (state) => state.triggerOpenWorkspaceFile
  );
  const showWorkspaceContextMenu = usePlumaStore(
    (state) => state.showWorkspaceContextMenu
  );
  const workspacePath = usePlumaStore((state) => state.workspace.workspacePath);
  const rootLabel =
    workspaceLabel === "No workspace open" ? "PLUMA DOCS" : workspaceLabel;

  return (
    <aside className="sidebar">
      {sidebarView === "search" ? (
        <WorkspaceSearch />
      ) : (
        <SidebarTree
          key={workspacePath}
          nodes={nodes}
          onOpenWorkspaceFile={triggerOpenWorkspaceFile}
          onShowContextMenu={showWorkspaceContextMenu}
          revealRequestId={revealRequestId}
          revealWorkspacePath={revealWorkspacePath}
          rootLabel={rootLabel}
        />
      )}

      <div className="sidebar-footer">
        <SidebarTabButton
          icon={FolderTree}
          isActive={sidebarView === "workspace"}
          label="Workspace"
          onClick={() => setSidebarView("workspace")}
          view="workspace"
        />
        <SidebarTabButton
          icon={Search}
          isActive={sidebarView === "search"}
          label="Search"
          onClick={() => setSidebarView("search")}
          view="search"
        />
      </div>
    </aside>
  );
});

type SidebarTabButtonProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  isActive: boolean;
  label: string;
  onClick: () => void;
  view: SidebarView;
};

function SidebarTabButton({
  icon: Icon,
  isActive,
  label,
  onClick,
  view
}: SidebarTabButtonProps) {
  return (
    <Tooltip.Provider delayDuration={350}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            aria-label={label}
            aria-pressed={isActive}
            className="sidebar-tab-button"
            data-sidebar-view={view}
            onClick={onClick}
            type="button"
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="titlebar-button-tooltip"
            side="top"
            sideOffset={6}
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
