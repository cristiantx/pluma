import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus
} from "lucide-react";
import type { CSSProperties } from "react";

import type { ExplorerNode } from "./types.js";

type SidebarProps = {
  nodes: ExplorerNode[];
  onOpenFile: () => void;
  onOpenFolder: () => void;
  workspaceLabel: string;
};

function getTreeItemStyle(depth: number): CSSProperties {
  return { "--depth": depth } as CSSProperties;
}

export function Sidebar({
  nodes,
  onOpenFile,
  onOpenFolder,
  workspaceLabel
}: SidebarProps) {
  const rootLabel =
    workspaceLabel === "No workspace open" ? "PLUMA DOCS" : workspaceLabel;

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Explorer</div>
      <div className="workspace-root">
        <ChevronDown className="disclosure-icon" aria-hidden="true" />
        <span>{rootLabel}</span>
      </div>

      <nav className="tree-list" aria-label="Files">
        {nodes.map((node) => (
          <button
            className={node.isActive ? "tree-item is-active" : "tree-item"}
            key={`${node.depth}-${node.kind}-${node.label}`}
            style={getTreeItemStyle(node.depth)}
            type="button"
          >
            {node.kind === "folder" && node.isExpanded ? (
              <ChevronDown className="disclosure-icon" aria-hidden="true" />
            ) : null}
            {node.kind === "folder" && !node.isExpanded ? (
              <ChevronRight className="disclosure-icon" aria-hidden="true" />
            ) : null}
            {node.kind === "file" ? (
              <span className="disclosure-spacer" aria-hidden="true" />
            ) : null}
            {node.kind === "folder" ? (
              <Folder className="tree-icon" aria-hidden="true" />
            ) : (
              <FileText className="tree-icon" aria-hidden="true" />
            )}
            <span>{node.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          aria-label="New file"
          className="sidebar-action"
          onClick={onOpenFile}
          type="button"
        >
          <FilePlus2 aria-hidden="true" />
        </button>
        <button
          aria-label="New folder"
          className="sidebar-action"
          onClick={onOpenFolder}
          type="button"
        >
          <FolderPlus aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
