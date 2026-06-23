import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { SidebarFooter } from "./SidebarFooter.js";
import { SidebarTitleBar } from "./SidebarTitleBar.js";
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
  const sidebarView = usePlumaStore((state) => state.workspace.sidebarView);
  const triggerOpenWorkspaceFile = usePlumaStore(
    (state) => state.triggerOpenWorkspaceFile
  );
  const showWorkspaceContextMenu = usePlumaStore(
    (state) => state.showWorkspaceContextMenu
  );
  const workspacePath = usePlumaStore((state) => state.workspace.workspacePath);

  return (
    <aside className="sidebar">
      <SidebarTitleBar />
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
        />
      )}
      <SidebarFooter />
    </aside>
  );
});
