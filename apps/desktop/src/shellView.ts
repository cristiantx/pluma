import type { ExplorerNode, StatusMetric } from "@pluma/ui";

import type { ShellState } from "./shellState";

export function extractLeafName(path: string | null): string | null {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[/\\]/);
  const leaf = segments[segments.length - 1];

  return leaf || normalized;
}

export function getWorkspaceLabel(state: ShellState): string {
  return (
    extractLeafName(state.activeFolder) ??
    extractLeafName(state.activeFile) ??
    "No workspace open"
  );
}

export function getStatusMetrics(state: ShellState): StatusMetric[] {
  const hasFile = Boolean(state.activeFile);

  return [
    {
      label: "Words",
      value: hasFile ? "0" : "--"
    },
    {
      label: "Lines",
      value: hasFile ? "0" : "--"
    },
    {
      label: "Mode",
      value: state.mode === "rich" ? "Rich" : "Source"
    },
    {
      label: "Save",
      value: state.status.toLowerCase().includes("save")
        ? "Pending"
        : "Idle shell"
    }
  ];
}

export function getExplorerNodes(state: ShellState): ExplorerNode[] {
  if (state.activeFolder) {
    const workspace = extractLeafName(state.activeFolder) ?? "Workspace";
    const activeFile = extractLeafName(state.activeFile) ?? "notes.md";

    return [
      { depth: 0, kind: "folder", label: "Guides", isExpanded: true },
      { depth: 1, kind: "file", label: activeFile, isActive: true },
      { depth: 1, kind: "file", label: "Syntax.md" },
      { depth: 1, kind: "file", label: "Links.md" },
      {
        depth: 0,
        kind: "folder",
        label: `${workspace} drafts`,
        isExpanded: true
      },
      { depth: 1, kind: "file", label: "Outline.md" },
      { depth: 1, kind: "file", label: "Reference.md" },
      { depth: 0, kind: "file", label: "README.md" }
    ];
  }

  if (state.activeFile) {
    const activeFile = extractLeafName(state.activeFile) ?? "current.md";

    return [
      { depth: 0, kind: "folder", label: "Current", isExpanded: true },
      { depth: 1, kind: "file", label: activeFile, isActive: true },
      { depth: 1, kind: "file", label: "Outline.md" },
      { depth: 1, kind: "file", label: "Reference.md" }
    ];
  }

  return [
    { depth: 0, kind: "folder", label: "Guides", isExpanded: true },
    { depth: 1, kind: "file", label: "Welcome.md", isActive: true },
    { depth: 1, kind: "file", label: "Syntax.md" },
    { depth: 1, kind: "file", label: "Links.md" },
    { depth: 1, kind: "file", label: "Images.md" },
    { depth: 0, kind: "folder", label: "Examples", isExpanded: true },
    { depth: 1, kind: "file", label: "Basic.md" },
    { depth: 1, kind: "file", label: "Advanced.md" },
    { depth: 0, kind: "file", label: "README.md" }
  ];
}
