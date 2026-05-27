import { PaneLayout } from "../panes/PaneLayout.js";
import { usePlumaStore } from "../state/usePlumaStore.js";
import { EditorWorkspace } from "./EditorWorkspace.js";
import { Sidebar } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { TitleBar } from "./TitleBar.js";

export function PlumaShell() {
  const resolvedTheme = usePlumaStore((state) => state.theme.resolvedTheme);
  const hasWorkspace = usePlumaStore((state) => state.workspace.hasWorkspace);

  return (
    <main className="shell" data-theme={resolvedTheme}>
      <TitleBar />
      {hasWorkspace ? (
        <PaneLayout main={<EditorWorkspace />} primary={<Sidebar />} />
      ) : (
        <EditorWorkspace />
      )}
      <StatusBar />
    </main>
  );
}
