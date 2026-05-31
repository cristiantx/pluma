import { FileText, FolderOpen } from "lucide-react";
import { memo } from "react";

import { usePlumaStore } from "../state/usePlumaStore.js";
import { SidebarTree } from "./SidebarTree.js";

export const Sidebar = memo(function Sidebar() {
  const nodes = usePlumaStore((state) => state.workspace.explorerNodes);
  const workspaceLabel = usePlumaStore(
    (state) => state.workspace.workspaceLabel
  );
  const triggerNewFile = usePlumaStore((state) => state.triggerNewFile);
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
          onClick={triggerNewFile}
          title="New file"
          type="button"
        >
          <FileText aria-hidden="true" />
        </button>
        <button
          aria-label="Open folder"
          className="sidebar-action"
          onClick={triggerOpenFolder}
          title="Open folder"
          type="button"
        >
          <FolderOpen aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
});
