import type { FileLocation } from "@pluma/core";

export type ExplorerNode = {
  depth: number;
  id: string;
  isActive?: boolean;
  isExpanded?: boolean;
  kind: "folder" | "file";
  label: string;
  location?: FileLocation;
};

export type StatusMetric = {
  label: string;
  value: string;
};
