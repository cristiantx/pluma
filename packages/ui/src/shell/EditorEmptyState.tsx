type EditorEmptyStateProps = {
  hasWorkspace: boolean;
};

export function EditorEmptyState({ hasWorkspace }: EditorEmptyStateProps) {
  return (
    <div className="editor-empty-state">
      <div className="editor-empty-copy">
        <h1>{hasWorkspace ? "Select a Markdown file" : "Welcome to Pluma"}</h1>
        <p>
          {hasWorkspace
            ? "Choose a file from the workspace tree to open a real document session."
            : "Pluma is ready for local-first Markdown files and folders."}
        </p>
      </div>
    </div>
  );
}
