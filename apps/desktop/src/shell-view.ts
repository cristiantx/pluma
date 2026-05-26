import type { ShellState } from "./shell-state";

export type StatusMetric = {
  label: string;
  value: string;
};

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

export function getSidebarEntries(state: ShellState): string[] {
  if (state.activeFolder) {
    const workspace = extractLeafName(state.activeFolder) ?? "Workspace";
    const file = extractLeafName(state.activeFile) ?? "README.md";

    return [
      workspace,
      `${workspace}/notes.md`,
      `${workspace}/drafts/`,
      `${workspace}/${file}`
    ];
  }

  if (state.activeFile) {
    const file = extractLeafName(state.activeFile) ?? "current.md";

    return [file, "outline.md", "reference.md"];
  }

  return ["welcome.md", "notes/", "drafts/", "archive/"];
}
