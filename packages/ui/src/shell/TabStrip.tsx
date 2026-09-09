import { DragDropProvider, PointerSensor } from "@dnd-kit/react";
import { useEffect, useRef, useState } from "react";

import { reorderTabsFromDragEvent } from "../adapters/tabModel.js";
import { usePlumaStore } from "../state/usePlumaStore.js";
import { getKeyboardTabIndex, getTabButtonId } from "./tabAccessibility.js";
import { TabButton } from "./TabButton.js";

export function TabStrip() {
  const tabbarScrollRef = useRef<HTMLDivElement | null>(null);
  const closingFocusedTabRef = useRef<string | null>(null);
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
    const closingTabId = closingFocusedTabRef.current;
    if (!closingTabId || tabs.some((tab) => tab.id === closingTabId)) return;
    closingFocusedTabRef.current = null;
    document.getElementById(getTabButtonId(activeTabId))?.focus();
  }, [activeTabId, tabs]);

  const handleTabClose = (tabId: string) => {
    const tabButton = document.getElementById(getTabButtonId(tabId));
    if (tabButton?.parentElement?.contains(document.activeElement)) {
      closingFocusedTabRef.current = tabId;
    }
    closeTab(tabId);
  };

  const navigateTab = (key: string, tabId: string) => {
    const index = getKeyboardTabIndex(
      key,
      tabs.findIndex((tab) => tab.id === tabId),
      tabs.length
    );
    const nextTab = index === null ? undefined : tabs[index];
    if (!nextTab) return false;
    setActiveTabId(nextTab.id);
    document.getElementById(getTabButtonId(nextTab.id))?.focus();
    document
      .getElementById(getTabButtonId(nextTab.id))
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  };

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
              onTabClose={handleTabClose}
              onNavigate={navigateTab}
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
