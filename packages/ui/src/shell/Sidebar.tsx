import { FilePlus2, FolderPlus } from "lucide-react";
import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { SidebarTree } from "./SidebarTree.js";

export const Sidebar = memo(function Sidebar() {
  const nodes = usePlumaStore((state) => state.workspace.explorerNodes);
  const workspaceLabel = usePlumaStore(
    (state) => state.workspace.workspaceLabel
  );
  const triggerOpenFile = usePlumaStore((state) => state.triggerOpenFile);
  const triggerOpenFolder = usePlumaStore((state) => state.triggerOpenFolder);
  const triggerOpenWorkspaceFile = usePlumaStore(
    (state) => state.triggerOpenWorkspaceFile
  );
  const workspacePath = usePlumaStore((state) => state.workspace.workspacePath);
  const rootLabel =
    workspaceLabel === "No workspace open" ? "PLUMA DOCS" : workspaceLabel;

  return (
    <aside className="sidebar">
      <SidebarTree
        key={workspacePath}
        nodes={nodes}
        onOpenWorkspaceFile={triggerOpenWorkspaceFile}
        rootLabel={rootLabel}
      />

      <div className="sidebar-footer">
        <button
          aria-label="New file"
          className="sidebar-action"
          onClick={triggerOpenFile}
          type="button"
        >
          <FilePlus2 aria-hidden="true" />
        </button>
        <button
          aria-label="New folder"
          className="sidebar-action"
          onClick={triggerOpenFolder}
          type="button"
        >
          <FolderPlus aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
});
