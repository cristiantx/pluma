import * as Tooltip from "@radix-ui/react-tooltip";
import { Code, Columns2, NotepadText } from "lucide-react";
import { memo } from "react";
import type { ComponentType, SVGProps } from "react";

import type { EditorViewMode } from "../state/plumaStoreTypes.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

const editorViewModes: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  mode: EditorViewMode;
}[] = [
  { icon: Code, label: "Code view", mode: "source" },
  { icon: NotepadText, label: "Rich view", mode: "rich" },
  { icon: Columns2, label: "Split view", mode: "split" }
];

export const StatusBar = memo(function StatusBar() {
  const activeDocument = usePlumaStore(
    (state) => state.document.activeDocument
  );
  const activeTabId = usePlumaStore((state) => state.tabs.activeTabId);
  const editorViewMode = usePlumaStore((state) => state.layout.editorViewMode);
  const metrics = usePlumaStore((state) => state.status.statusMetrics);
  const setEditorViewMode = usePlumaStore((state) => state.setEditorViewMode);
  const hasActiveDocumentTab =
    activeDocument !== null && activeTabId === activeDocument.id;

  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        {hasActiveDocumentTab
          ? metrics.map((metric) => (
              <span className="status-metric" key={metric.label}>
                <span className="status-metric-label">{metric.label}</span>
                <span className="status-metric-value">{metric.value}</span>
              </span>
            ))
          : null}
      </div>
      <div className="statusbar-group">
        {hasActiveDocumentTab ? (
          <Tooltip.Provider delayDuration={350}>
            <div
              className="statusbar-view-switch"
              aria-label="Editor view mode"
            >
              {editorViewModes.map((item) => {
                const Icon = item.icon;

                return (
                  <Tooltip.Root key={item.mode}>
                    <Tooltip.Trigger asChild>
                      <button
                        aria-label={item.label}
                        aria-pressed={editorViewMode === item.mode}
                        className="statusbar-view-switch-button"
                        onClick={() => setEditorViewMode(item.mode)}
                        type="button"
                      >
                        <Icon aria-hidden="true" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="titlebar-button-tooltip"
                        side="top"
                        sideOffset={4}
                      >
                        {item.label}
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })}
            </div>
          </Tooltip.Provider>
        ) : null}
      </div>
    </footer>
  );
});
