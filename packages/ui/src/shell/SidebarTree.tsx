import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { FileLocation } from "@pluma/core";

import { buildSidebarTreeData } from "../adapters/sidebarTree.js";
import type { ExplorerNode } from "./types.js";

type SidebarTreeProps = {
  nodes: ExplorerNode[];
  revealRequestId: number;
  revealWorkspacePath: string | null;
  onOpenWorkspaceFile: (path: string) => void;
  onShowContextMenu: (path: string, kind: ExplorerNode["kind"]) => void;
};

function getTreeItemStyle(depth: number): CSSProperties {
  return { "--depth": depth } as CSSProperties;
}

function getRenderedTreeItemDepth(depth: number): number {
  return Math.max(0, depth - 1);
}

export function SidebarTree({
  nodes,
  revealRequestId,
  revealWorkspacePath,
  onOpenWorkspaceFile,
  onShowContextMenu
}: SidebarTreeProps) {
  const treeData = useMemo(
    () => buildSidebarTreeData("Files", nodes, revealWorkspacePath),
    [nodes, revealWorkspacePath]
  );
  const [expandedItems, setExpandedItems] = useState(treeData.expandedItems);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const fallbackNode = treeData.tree[treeData.rootItemId];

  if (!fallbackNode) {
    throw new Error("Sidebar tree root node was not created.");
  }

  useEffect(() => {
    setExpandedItems((currentExpandedItems) => [
      ...new Set([...treeData.expandedItems, ...currentExpandedItems])
    ]);
  }, [treeData.expandedItems]);

  useEffect(() => {
    if (revealRequestId === 0 || !treeData.revealItemId) {
      return;
    }

    setExpandedItems((currentExpandedItems) => [
      ...new Set([...currentExpandedItems, ...treeData.revealExpandedItems])
    ]);
    setFocusedItem(treeData.revealItemId);

    window.setTimeout(() => {
      const targetElement = document.querySelector<HTMLElement>(
        `[data-tree-item-id="${CSS.escape(treeData.revealItemId ?? "")}"]`
      );

      targetElement?.scrollIntoView({ block: "center" });
      targetElement?.focus();
    });
  }, [revealRequestId, treeData.revealItemId]);

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
      expandedItems: treeData.expandedItems
    },
    state: {
      expandedItems,
      focusedItem,
      selectedItems: treeData.selectedItems
    },
    setState: (updaterOrValue) => {
      const nextState =
        typeof updaterOrValue === "function"
          ? updaterOrValue({
              expandedItems,
              focusedItem,
              selectedItems: treeData.selectedItems
            })
          : updaterOrValue;

      if (nextState.expandedItems) {
        setExpandedItems(nextState.expandedItems);
      }

      if (nextState.focusedItem !== undefined) {
        setFocusedItem(nextState.focusedItem);
      }
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature]
  });

  return (
    <div {...tree.getContainerProps("Files")} className="tree-list" role="tree">
      {tree.getItems().map((item) => {
        if (item.getId() === treeData.rootItemId) {
          return null;
        }

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
            style={getTreeItemStyle(
              getRenderedTreeItemDepth(item.getItemMeta().level)
            )}
            type="button"
            data-tree-item-id={item.getId()}
            {...itemProps}
            onContextMenu={(event) => {
              itemProps.onContextMenu?.(event);

              if (itemData.location?.kind !== "desktop-path") {
                return;
              }

              event.preventDefault();
              item.select();
              onShowContextMenu(itemData.location.path, itemData.kind);
            }}
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
