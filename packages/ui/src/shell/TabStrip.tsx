import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FileText, GripVertical, Plus, X } from "lucide-react";

import { getFileLocationName } from "@pluma/core";
import { reorderTabsFromDragEvent, type EditorTab } from "./tabModel.js";

type TabStripProps = {
  activeTabId: string;
  onActiveTabChange: (tabId: string) => void;
  onOpenFile: () => void;
  onTabClose: (tabId: string) => void;
  onTabsReorder: (tabs: EditorTab[]) => void;
  tabs: EditorTab[];
};

type TabButtonProps = {
  activeTabId: string;
  onActiveTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  tab: EditorTab;
  tabIndex: number;
};

function TabButton({
  activeTabId,
  onActiveTabChange,
  onTabClose,
  tab,
  tabIndex
}: TabButtonProps) {
  const sortable = useSortable({
    id: tab.id,
    index: tabIndex
  });

  return (
    <div
      className={tab.id === activeTabId ? "tab is-active" : "tab"}
      ref={sortable.ref}
      role="presentation"
    >
      <button
        aria-label={`Reorder ${tab.title}`}
        className="tab-handle"
        ref={sortable.handleRef}
        type="button"
      >
        <GripVertical aria-hidden="true" />
      </button>
      <button
        aria-selected={tab.id === activeTabId}
        className="tab-activate"
        onClick={() => onActiveTabChange(tab.id)}
        role="tab"
        type="button"
      >
        <FileText className="tree-icon" aria-hidden="true" />
        <span className="tab-label">
          {tab.title}
          {tab.isDirty ? <span className="tab-dirty-indicator">•</span> : null}
        </span>
        <span className="tab-path">{getFileLocationName(tab.location)}</span>
      </button>
      <span
        aria-hidden="true"
        className={
          sortable.isDragging ? "tab-drag-state is-visible" : "tab-drag-state"
        }
      />
      <span
        aria-hidden="true"
        className={
          sortable.isDropTarget
            ? "tab-drop-target is-visible"
            : "tab-drop-target"
        }
      />
      <button
        aria-label={`Close ${tab.title}`}
        className="tab-close"
        onClick={() => onTabClose(tab.id)}
        type="button"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

export function TabStrip({
  activeTabId,
  onActiveTabChange,
  onOpenFile,
  onTabClose,
  onTabsReorder,
  tabs
}: TabStripProps) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        onTabsReorder(reorderTabsFromDragEvent(tabs, event));
      }}
    >
      <div className="tabbar" aria-label="Open documents" role="tablist">
        <div className="tabbar-scroll">
          {tabs.map((tab, tabIndex) => (
            <TabButton
              activeTabId={activeTabId}
              key={tab.id}
              onActiveTabChange={onActiveTabChange}
              onTabClose={onTabClose}
              tab={tab}
              tabIndex={tabIndex}
            />
          ))}
        </div>
        <button
          aria-label="New tab"
          className="new-tab"
          onClick={onOpenFile}
          type="button"
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </DragDropProvider>
  );
}
