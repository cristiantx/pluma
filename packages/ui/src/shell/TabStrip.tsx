import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FileText, X } from "lucide-react";
import { useRef } from "react";

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
  const isActive = tab.id === activeTabId;

  return (
    <div
      className={isActive ? "tab is-active" : "tab"}
      ref={sortable.ref}
      role="presentation"
    >
      <button
        aria-selected={isActive}
        className="tab-activate"
        onAuxClick={(event) => {
          if (event.button !== 1) {
            return;
          }

          event.preventDefault();
          onTabClose(tab.id);
        }}
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
  const tabbarScrollRef = useRef<HTMLDivElement | null>(null);
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
        <div
          className="tabbar-scroll"
          onWheel={(event) => {
            const container = tabbarScrollRef.current;
            if (!container) {
              return;
            }

            if (
              Math.abs(event.deltaY) <= Math.abs(event.deltaX) &&
              event.deltaX === 0
            ) {
              return;
            }

            event.preventDefault();
            container.scrollLeft += event.deltaY || event.deltaX;
          }}
          ref={tabbarScrollRef}
        >
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
