import type { DocumentSaveState } from "@pluma/core";

type SaveConflictBannerProps = {
  onKeepEditing: () => void;
  onReload: () => void;
  saveState: Extract<DocumentSaveState, "conflict" | "external-change">;
};

export function SaveConflictBanner({
  onKeepEditing,
  onReload,
  saveState
}: SaveConflictBannerProps) {
  return (
    <div
      className="save-conflict-banner"
      role="status"
      data-save-state={saveState}
    >
      <span>
        {saveState === "external-change"
          ? "This file changed on disk."
          : "This file has a save conflict."}
      </span>
      <div className="save-conflict-actions">
        <button onClick={onReload} type="button">
          Reload
        </button>
        <button onClick={onKeepEditing} type="button">
          Keep Editing
        </button>
      </div>
    </div>
  );
}
