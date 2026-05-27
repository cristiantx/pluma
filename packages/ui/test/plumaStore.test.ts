import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorTab } from "../src/adapters/tabModel.js";
import {
  initialPlumaStoreState,
  usePlumaStore
} from "../src/state/usePlumaStore.js";
import type { PlumaShellSnapshot } from "../src/state/plumaStoreTypes.js";

const baseTabs: EditorTab[] = [
  {
    id: "welcome",
    isDirty: false,
    location: {
      kind: "desktop-path",
      path: "/Users/cristianc/Documents/Pluma Docs/Welcome.md"
    },
    title: "Welcome.md"
  },
  {
    id: "syntax",
    isDirty: true,
    location: {
      kind: "desktop-path",
      path: "/Users/cristianc/Documents/Pluma Docs/Syntax.md"
    },
    title: "Syntax.md"
  }
];

const baseSnapshot: PlumaShellSnapshot = {
  explorerNodes: [
    { depth: 0, kind: "folder", label: "Guides" },
    { depth: 1, isActive: true, kind: "file", label: "Welcome.md" }
  ],
  isBridgeAvailable: true,
  statusMetrics: [
    { label: "Words", value: "312" },
    { label: "Lines", value: "28" }
  ],
  tabs: baseTabs,
  workspaceLabel: "PLUMA DOCS",
  workspacePath: "/Users/cristianc/Documents/Pluma Docs"
};

beforeEach(() => {
  usePlumaStore.setState({
    ...usePlumaStore.getState(),
    ...initialPlumaStoreState
  });
});

describe("usePlumaStore", () => {
  it("hydrates shell data into shared slices", () => {
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);

    const state = usePlumaStore.getState();

    expect(state.workspace.workspaceLabel).toBe("PLUMA DOCS");
    expect(state.workspace.explorerNodes).toHaveLength(2);
    expect(state.tabs.tabs).toEqual(baseTabs);
    expect(state.tabs.activeTabId).toBe("welcome");
    expect(state.status.statusMetrics[0]?.value).toBe("312");
  });

  it("keeps user tab order when new shell snapshots arrive", () => {
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().reorderTabs([...baseTabs].reverse());

    usePlumaStore.getState().hydrateShellSnapshot({
      ...baseSnapshot,
      tabs: [baseTabs[0]]
    });

    expect(usePlumaStore.getState().tabs.tabs[0]?.id).toBe("syntax");
  });

  it("resolves theme preferences against the system theme", () => {
    usePlumaStore.getState().setSystemPrefersDark(true);
    usePlumaStore.getState().setThemePreference("system");

    expect(usePlumaStore.getState().theme.resolvedTheme).toBe("dark");

    usePlumaStore.getState().toggleTheme();

    expect(usePlumaStore.getState().theme.preference).toBe("light");
    expect(usePlumaStore.getState().theme.resolvedTheme).toBe("light");
  });

  it("closes tabs and reassigns the active tab", () => {
    usePlumaStore.getState().hydrateShellSnapshot(baseSnapshot);
    usePlumaStore.getState().setActiveTabId("syntax");

    usePlumaStore.getState().closeTab("syntax");

    expect(usePlumaStore.getState().tabs.activeTabId).toBe("welcome");
    expect(usePlumaStore.getState().tabs.tabs).toHaveLength(1);
  });

  it("triggers registered commands through typed handlers", () => {
    const openFile = vi.fn();

    usePlumaStore.getState().setCommandHandlers({ openFile });
    usePlumaStore.getState().triggerOpenFile();

    expect(openFile).toHaveBeenCalledTimes(1);
  });
});
