import { isSortable } from "@dnd-kit/react/sortable";
import type { FileLocation } from "@pluma/core";

export type EditorTab = {
  id: string;
  isDirty?: boolean;
  location: FileLocation;
  title: string;
};

type SortableDragEndEvent = {
  canceled: boolean;
  operation: {
    source: object | null;
  };
};

export function reorderTabItems(
  tabs: EditorTab[],
  fromIndex: number,
  toIndex: number
): EditorTab[] {
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
  tabs: EditorTab[],
  event: SortableDragEndEvent
): EditorTab[] {
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
