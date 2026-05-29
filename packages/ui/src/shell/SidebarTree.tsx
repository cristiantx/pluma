import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { CSSProperties } from "react";
import type { FileLocation } from "@pluma/core";

import { buildSidebarTreeData } from "../adapters/sidebarTree.js";
import type { ExplorerNode } from "./types.js";

type SidebarTreeProps = {
  nodes: ExplorerNode[];
  rootLabel: string;
  onOpenWorkspaceFile: (path: string) => void;
};

function getTreeItemStyle(depth: number): CSSProperties {
  return { "--depth": depth } as CSSProperties;
}

export function SidebarTree({
  nodes,
  rootLabel,
  onOpenWorkspaceFile
}: SidebarTreeProps) {
  const treeData = buildSidebarTreeData(rootLabel, nodes);
  const fallbackNode = treeData.tree[treeData.rootItemId];

  if (!fallbackNode) {
    throw new Error("Sidebar tree root node was not created.");
  }

  const tree = useTree<{
    children?: string[];
    kind: "folder" | "file";
    label: string;
    location?: FileLocation;
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
    <div {...tree.getContainerProps("Files")} className="tree-list" role="tree">
      {tree.getItems().map((item) => {
        const itemProps = item.getProps();
        const itemData = item.getItemData();

        return (
          <button
            className={[
              "tree-item",
              item.isFolder() ? "tree-item-folder" : "tree-item-file",
              item.isSelected() ? "is-active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={item.getId()}
            style={getTreeItemStyle(item.getItemMeta().level)}
            type="button"
            {...itemProps}
            onClick={(event) => {
              itemProps.onClick?.(event);

              if (
                itemData.kind === "file" &&
                itemData.location?.kind === "desktop-path"
              ) {
                onOpenWorkspaceFile(itemData.location.path);
              }
            }}
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
            {!item.isFolder() ? (
              <FileText className="tree-icon" aria-hidden="true" />
            ) : null}
            <span className="tree-item-label">{item.getItemName()}</span>
          </button>
        );
      })}
    </div>
  );
}
