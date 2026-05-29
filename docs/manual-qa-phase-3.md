# Phase 3 Manual QA

Run the desktop app with:

```bash
pnpm desktop:dev
```

Verify:

- `Open Folder` loads a real workspace tree with only Markdown files.
- Opening a folder does not force-open a document; the editor shows the workspace empty state until a file is selected.
- Selecting a file from the sidebar opens a real document tab and loads the source text into the workspace.
- Opening a standalone Markdown file loads it without showing the workspace sidebar.
- Reopening a file already in tabs focuses the existing document session instead of duplicating it.
- `Cmd/Ctrl+O` opens a Markdown file and updates the active document tab.
- `Cmd/Ctrl+Shift+O` opens a folder and updates the sidebar tree.
- `Cmd/Ctrl+\` still toggles the shell mode state.
- On macOS, opening a Markdown file while Pluma is already running routes it into the existing instance.
- On Windows/Linux, launching Pluma with a Markdown file path opens that file.
- Relative Markdown references resolve from the active file path through the shared core helper.
