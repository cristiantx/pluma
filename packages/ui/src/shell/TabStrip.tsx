import { DragDropProvider, PointerSensor } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  reorderTabsFromDragEvent,
  type EditorTab
} from "../adapters/tabModel.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

type TabButtonProps = {
  activeTabId: string;
  onActiveTabChange: (tabId: string) => void;
  onContextMenu: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  tab: EditorTab;
  tabIndex: number;
};

function TabButton({
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
  const scrollHideTimeoutRef = useRef<number | null>(null);
  const activeTabId = usePlumaStore((state) => state.tabs.activeTabId);
  const tabs = usePlumaStore((state) => state.tabs.tabs);
  const setActiveTabId = usePlumaStore((state) => state.setActiveTabId);
  const closeTab = usePlumaStore((state) => state.closeTab);
  const reorderTabs = usePlumaStore((state) => state.reorderTabs);
  const showTabContextMenu = usePlumaStore((state) => state.showTabContextMenu);
  const [scrollIndicator, setScrollIndicator] = useState({
    isVisible: false,
    left: 0,
    width: 0
  });

  useEffect(() => {
    const container = tabbarScrollRef.current;
    if (!container) {
      return;
    }

    const updateScrollIndicator = (isVisible: boolean) => {
      const { clientWidth, scrollLeft, scrollWidth } = container;

      if (scrollWidth <= clientWidth || clientWidth === 0) {
        setScrollIndicator({
          isVisible: false,
          left: 0,
          width: 0
        });
        return;
      }

      const trackWidth = clientWidth - 12;
      const thumbWidth = Math.max(
        28,
        Math.round((clientWidth / scrollWidth) * trackWidth)
      );
      const maxScrollLeft = scrollWidth - clientWidth;
      const maxThumbOffset = trackWidth - thumbWidth;
      const left =
        maxScrollLeft > 0
          ? Math.round((scrollLeft / maxScrollLeft) * maxThumbOffset)
          : 0;

      setScrollIndicator({
        isVisible,
        left,
        width: thumbWidth
      });
    };

    const revealScrollIndicator = () => {
      updateScrollIndicator(true);

      if (scrollHideTimeoutRef.current !== null) {
        window.clearTimeout(scrollHideTimeoutRef.current);
      }

      scrollHideTimeoutRef.current = window.setTimeout(() => {
        updateScrollIndicator(false);
      }, 700);
    };

    const handleWheel = (event: WheelEvent) => {
      if (
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) &&
        event.deltaX === 0
      ) {
        return;
      }

      event.preventDefault();
      container.scrollLeft += event.deltaY || event.deltaX;
      revealScrollIndicator();
    };

    const handleScroll = () => {
      revealScrollIndicator();
    };

    const resizeObserver = new ResizeObserver(() => {
      updateScrollIndicator(false);
    });

    updateScrollIndicator(false);
    resizeObserver.observe(container);
    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleWheel);

      if (scrollHideTimeoutRef.current !== null) {
        window.clearTimeout(scrollHideTimeoutRef.current);
      }
    };
  }, [tabs.length]);

  return (
    <DragDropProvider
      sensors={[
        PointerSensor.configure({
          activationConstraints: {
            distance: {
              value: 6
            }
          }
        })
      ]}
      onDragEnd={(event) => {
        reorderTabs(reorderTabsFromDragEvent(tabs, event));
      }}
    >
      <div className="tabbar" aria-label="Open documents" role="tablist">
        <div className="tabbar-scroll" ref={tabbarScrollRef}>
          {tabs.map((tab, tabIndex) => (
            <TabButton
              activeTabId={activeTabId}
              key={tab.id}
              onActiveTabChange={setActiveTabId}
              onContextMenu={showTabContextMenu}
              onTabClose={closeTab}
              tab={tab}
              tabIndex={tabIndex}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className={
            scrollIndicator.isVisible
              ? "tabbar-scroll-indicator is-visible"
              : "tabbar-scroll-indicator"
          }
          style={{
            transform: `translateX(${scrollIndicator.left}px)`,
            width: `${scrollIndicator.width}px`
          }}
        />
      </div>
    </DragDropProvider>
  );
}
