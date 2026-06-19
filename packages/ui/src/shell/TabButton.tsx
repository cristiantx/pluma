import { useSortable } from "@dnd-kit/react/sortable";
import { FileText, X } from "lucide-react";

import type { EditorTab } from "../adapters/tabModel.js";

type TabButtonProps = {
  activeTabId: string;
  onActiveTabChange: (tabId: string) => void;
  onContextMenu: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  tab: EditorTab;
  tabIndex: number;
};

export function TabButton({
  activeTabId,
  onActiveTabChange,
  onContextMenu,
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
        onContextMenu={(event) => {
          event.preventDefault();
          onActiveTabChange(tab.id);
          onContextMenu(tab.id);
        }}
        ref={sortable.handleRef}
        role="tab"
        type="button"
      >
        <FileText className="tree-icon" aria-hidden="true" />
        <span className="tab-label">
          <span className="tab-title">{tab.title}</span>
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
