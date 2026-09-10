export type QuickAccessMode = "files" | "commands";
export type QuickAccessMatch = { start: number; end: number };
export type QuickAccessRow = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
  reason?: string;
  checked?: boolean;
  labelMatches?: QuickAccessMatch[];
  descriptionMatches?: QuickAccessMatch[];
};

export type QuickAccessDialogProps = {
  mode: QuickAccessMode;
  query: string;
  rows: QuickAccessRow[];
  selectedId: string | null;
  status: string;
  error: string | null;
  busy: boolean;
  focusRequestId: number;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onSubmit: (id: string) => void;
  onClose: () => void;
  onModeChange: (mode: QuickAccessMode) => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onRetry?: () => void;
};

export function quickAccessOptionId(prefix: string, id: string) {
  return `${prefix}-option-${encodeURIComponent(id)}`;
}

export function nextQuickAccessIndex(
  index: number,
  count: number,
  key: string
) {
  if (!count) return -1;
  if (key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowUp")
    return index < 0 ? count - 1 : (index - 1 + count) % count;
  if (key === "PageDown") return Math.min(count - 1, Math.max(0, index) + 8);
  if (key === "PageUp") return Math.max(0, index - 8);
  return index;
}
