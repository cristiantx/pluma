import { isSortable } from "@dnd-kit/react/sortable";
import type { FileLocation } from "@pluma/core";

export type EditorTab = {
  kind?: "document";
  id: string;
  isDirty?: boolean;
  location: FileLocation;
  title: string;
};

export type SettingsTab = {
  id: "settings";
  kind: "settings";
  title: "Settings";
};

export type PlumaTab = EditorTab | SettingsTab;

type SortableDragEndEvent = {
  canceled: boolean;
  operation: {
    source: object | null;
  };
};

export function reorderTabItems(
  tabs: PlumaTab[],
  fromIndex: number,
  toIndex: number
): PlumaTab[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= tabs.length ||
    toIndex >= tabs.length
  ) {
    return tabs;
  }

  const nextTabs = [...tabs];
  const [movedTab] = nextTabs.splice(fromIndex, 1);

  if (!movedTab) {
    return tabs;
  }

  nextTabs.splice(toIndex, 0, movedTab);
  return nextTabs;
}

export function reorderTabsFromDragEvent(
  tabs: PlumaTab[],
  event: SortableDragEndEvent
): PlumaTab[] {
  if (event.canceled) {
    return tabs;
  }

  const { source } = event.operation;

  if (
    !isSortable(source as never) ||
    source === null ||
    !("initialIndex" in source) ||
    !("index" in source)
  ) {
    return tabs;
  }

  const sortableSource = source as {
    index: number;
    initialIndex: number;
  };

  return reorderTabItems(
    tabs,
    sortableSource.initialIndex,
    sortableSource.index
  );
}
