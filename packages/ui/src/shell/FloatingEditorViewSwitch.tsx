import * as Tooltip from "@radix-ui/react-tooltip";
import { Code, NotepadText } from "lucide-react";
import { memo } from "react";
import type { ComponentType, CSSProperties, SVGProps } from "react";

import type { EditorViewMode } from "../state/plumaStoreTypes.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

const editorViewModes: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  mode: EditorViewMode;
}[] = [
  { icon: Code, label: "Code view", mode: "source" },
  { icon: NotepadText, label: "Rich view", mode: "rich" }
];

export const FloatingEditorViewSwitch = memo(
  function FloatingEditorViewSwitch() {
    const activeDocument = usePlumaStore(
      (state) => state.document.activeDocument
    );
    const activeTabId = usePlumaStore((state) => state.tabs.activeTabId);
    const editorViewMode = usePlumaStore(
      (state) => state.layout.editorViewMode
    );
    const setEditorViewMode = usePlumaStore((state) => state.setEditorViewMode);
    const hasActiveDocumentTab =
      activeDocument !== null && activeTabId === activeDocument.id;
    const activeModeIndex = Math.max(
      0,
      editorViewModes.findIndex((item) => item.mode === editorViewMode)
    );

    if (!hasActiveDocumentTab) {
      return null;
    }

    return (
      <Tooltip.Provider delayDuration={350}>
        <div
          className="floating-editor-view-switch"
          aria-label="Editor view mode"
          role="group"
          style={
            {
              "--editor-view-mode-count": editorViewModes.length,
              "--editor-view-mode-index": activeModeIndex
            } as CSSProperties
          }
        >
          <span
            aria-hidden="true"
            className="floating-editor-view-switch-active"
          />
          {editorViewModes.map((item) => {
            const Icon = item.icon;

            return (
              <Tooltip.Root key={item.mode}>
                <Tooltip.Trigger asChild>
                  <button
                    aria-label={item.label}
                    aria-pressed={editorViewMode === item.mode}
                    className="floating-editor-view-switch-button"
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
                    sideOffset={6}
                  >
                    {item.label}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </div>
      </Tooltip.Provider>
    );
  }
);
