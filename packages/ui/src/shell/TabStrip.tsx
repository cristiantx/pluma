import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FileText, X } from "lucide-react";

import { getFileLocationName } from "@pluma/core";
import {
  reorderTabsFromDragEvent,
  type EditorTab
} from "../adapters/tabModel.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

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
        aria-selected={tab.id === activeTabId}
        className="tab-activate"
        onClick={() => onActiveTabChange(tab.id)}
        ref={sortable.handleRef}
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

export function TabStrip() {
  const activeTabId = usePlumaStore((state) => state.tabs.activeTabId);
  const tabs = usePlumaStore((state) => state.tabs.tabs);
  const setActiveTabId = usePlumaStore((state) => state.setActiveTabId);
  const closeTab = usePlumaStore((state) => state.closeTab);
  const reorderTabs = usePlumaStore((state) => state.reorderTabs);

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        reorderTabs(reorderTabsFromDragEvent(tabs, event));
      }}
    >
      <div className="tabbar" aria-label="Open documents" role="tablist">
        <div className="tabbar-scroll">
          {tabs.map((tab, tabIndex) => (
            <TabButton
              activeTabId={activeTabId}
              key={tab.id}
              onActiveTabChange={setActiveTabId}
              onTabClose={closeTab}
              tab={tab}
              tabIndex={tabIndex}
            />
          ))}
        </div>
      </div>
    </DragDropProvider>
  );
}
