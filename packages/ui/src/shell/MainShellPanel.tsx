import { memo } from "react";

import { EditorWorkspace } from "./EditorWorkspace.js";
import { FloatingEditorViewSwitch } from "./FloatingEditorViewSwitch.js";
import { TitleBar } from "./TitleBar.js";

export const MainShellPanel = memo(function MainShellPanel() {
  return (
    <section className="main-shell-panel" aria-label="Editor workspace">
      <TitleBar />
      <div className="shell-content">
        <EditorWorkspace />
      </div>
      <FloatingEditorViewSwitch />
    </section>
  );
});
