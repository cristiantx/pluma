import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus
} from "lucide-react";
import type { CSSProperties } from "react";

import { buildSidebarTreeData } from "../adapters/sidebarTree.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

function getTreeItemStyle(depth: number): CSSProperties {
  return { "--depth": depth } as CSSProperties;
}

export function Sidebar() {
  const nodes = usePlumaStore((state) => state.workspace.explorerNodes);
  const workspaceLabel = usePlumaStore(
    (state) => state.workspace.workspaceLabel
  );
  const triggerOpenFile = usePlumaStore((state) => state.triggerOpenFile);
  const triggerOpenFolder = usePlumaStore((state) => state.triggerOpenFolder);
  const rootLabel =
    workspaceLabel === "No workspace open" ? "PLUMA DOCS" : workspaceLabel;
  const treeData = buildSidebarTreeData(rootLabel, nodes);
  const fallbackNode = treeData.tree[treeData.rootItemId];

  if (!fallbackNode) {
    throw new Error("Sidebar tree root node was not created.");
  }

  const tree = useTree<{
    children?: string[];
    kind: "folder" | "file";
    label: string;
  }>({
    rootItemId: treeData.rootItemId,
    getItemName: (item) => item.getItemData().label,
    isItemFolder: (item) => item.getItemData().kind === "folder",
    dataLoader: {
      getItem: (itemId) => treeData.tree[itemId] ?? fallbackNode,
      getChildren: (itemId) => treeData.tree[itemId]?.children ?? []
    },
    initialState: {
      expandedItems: treeData.expandedItems,
      selectedItems: treeData.selectedItems
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature]
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Explorer</div>
      <div className="workspace-root">
        <ChevronDown className="disclosure-icon" aria-hidden="true" />
        <span>{rootLabel}</span>
      </div>

      <div
        {...tree.getContainerProps("Files")}
        className="tree-list"
        role="tree"
      >
        {tree.getItems().map((item) => (
          <button
            className={item.isSelected() ? "tree-item is-active" : "tree-item"}
            key={item.getId()}
            style={getTreeItemStyle(item.getItemMeta().level)}
            type="button"
            {...item.getProps()}
          >
            {item.isFolder() && item.isExpanded() ? (
              <ChevronDown className="disclosure-icon" aria-hidden="true" />
            ) : null}
            {item.isFolder() && !item.isExpanded() ? (
              <ChevronRight className="disclosure-icon" aria-hidden="true" />
            ) : null}
            {!item.isFolder() ? (
              <span className="disclosure-spacer" aria-hidden="true" />
            ) : null}
            {item.isFolder() ? (
              <Folder className="tree-icon" aria-hidden="true" />
            ) : (
              <FileText className="tree-icon" aria-hidden="true" />
            )}
            <span>{item.getItemName()}</span>
          </button>
        ))}
      </div>

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
}
