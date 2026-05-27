export type ExplorerNode = {
  depth: number;
  isActive?: boolean;
  isExpanded?: boolean;
  kind: "folder" | "file";
  label: string;
};

export type StatusMetric = {
  label: string;
  value: string;
};
