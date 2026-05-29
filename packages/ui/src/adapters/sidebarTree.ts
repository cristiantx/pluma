import type { FileLocation } from "@pluma/core";

export type SidebarTreeNode = {
  children?: string[];
  kind: "folder" | "file";
  label: string;
  location?: FileLocation;
};

export type SidebarTreeData = {
  expandedItems: string[];
  rootItemId: string;
  selectedItems: string[];
  tree: Record<string, SidebarTreeNode>;
};

function normalizeNodeId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function buildSidebarTreeData(
  workspaceLabel: string,
  nodes: Array<{
    depth: number;
    id?: string;
    isActive?: boolean;
    isExpanded?: boolean;
    kind: "folder" | "file";
    label: string;
    location?: FileLocation;
  }>
): SidebarTreeData {
  const rootItemId = "workspace-root";
  const tree: Record<string, SidebarTreeNode> = {
    [rootItemId]: {
      children: [],
      kind: "folder",
      label: workspaceLabel
    }
  };
  const expandedItems = [rootItemId];
  const selectedItems: string[] = [];
  const ancestors = [rootItemId];
  const siblingCounts = new Map<string, number>();

  nodes.forEach((node) => {
    const parentId = ancestors[node.depth] ?? rootItemId;
    const siblingCount = siblingCounts.get(parentId) ?? 0;
    const nodeId =
      node.id ?? `${parentId}/${normalizeNodeId(node.label)}-${siblingCount}`;

    siblingCounts.set(parentId, siblingCount + 1);
    tree[nodeId] = {
      ...(node.kind === "folder" ? { children: [] } : {}),
      kind: node.kind,
      label: node.label,
      ...(node.location ? { location: node.location } : {})
    };
    tree[parentId]?.children?.push(nodeId);

    if (node.kind === "folder") {
      ancestors[node.depth + 1] = nodeId;

      if (node.isExpanded) {
        expandedItems.push(nodeId);
      }
    }

    if (node.isActive) {
      selectedItems.push(nodeId);
    }
  });

  return {
    expandedItems,
    rootItemId,
    selectedItems,
    tree
  };
}
