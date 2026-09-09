export const EDITOR_TAB_PANEL_ID = "pluma-editor-panel";

export function getTabButtonId(tabId: string): string {
  return `pluma-tab-${encodeURIComponent(tabId)}`;
}

export function getKeyboardTabIndex(
  key: string,
  currentIndex: number,
  tabCount: number
): number | null {
  if (tabCount === 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return tabCount - 1;
  if (key === "ArrowLeft") return (currentIndex - 1 + tabCount) % tabCount;
  if (key === "ArrowRight") return (currentIndex + 1) % tabCount;
  return null;
}
