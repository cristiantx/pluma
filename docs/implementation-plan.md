# Pluma Implementation Plan

Pluma is an open-source, local-first Markdown editor. The MVP should feel polished and approachable while keeping Markdown files as normal files on disk. The first MVP target is macOS desktop, with architecture shaped so future Windows, Linux, and browser versions can reuse the same core document and filesystem abstractions.

## Guiding Decisions

- [ ] Use Electron, React, TypeScript, Vite, and Electron Forge for the desktop MVP.
- [ ] Target macOS only for the MVP; defer Windows and Linux packaging until after the first macOS release.
- [ ] Use Radix Primitives for renderer UI primitives that are not provided by the OS shell.
- [ ] Use `allotment` for VS Code-like split panes in the desktop and shared app shell.
- [ ] Use `Headless Tree` for the workspace file tree and related tree interactions.
- [ ] Use a custom tab strip in `packages/ui` for open-document tabs.
- [ ] Use `dnd-kit` to support tab reordering in the shared tab strip.
- [ ] Support semantic app theming with `system`, `light`, and `dark` modes.
- [ ] Use a custom title bar and frameless desktop shell with a VS Code-inspired workspace layout.
- [ ] Keep Markdown source text as the canonical document format.
- [ ] Use Milkdown for rich Markdown editing when a document is safe for rich mode.
- [ ] Use CodeMirror 6 for source mode.
- [ ] Treat source mode as a first-class editor, not just an escape hatch.
- [ ] Preserve unsupported Markdown by avoiding destructive rich-mode saves.
- [ ] Support direct `.md` file opening and folder-based Markdown browsing.
- [ ] Defer accounts, sync, cloud storage, servers, plugins, auto-update, and pasted-image asset management.

## Future Evaluation Notes

- Keep editor engine logic isolated from Electron and app-shell UI.
- Continue with Milkdown for rich mode and CodeMirror 6 for source mode unless implementation evidence shows a stronger reason to switch.
- Library candidates worth evaluating during their relevant phases:
  - `chokidar` for active-file and folder watching.
  - `@vscode/ripgrep` for fast workspace search.
  - `github-markdown-css` as a preview-rendering reference, not necessarily as Pluma's final visual layer.
  - `katex` for math rendering.
  - `mermaid` for diagram rendering.
  - `dompurify` for sanitized rendered HTML if preview/export flows render user Markdown to HTML.
  - `turndown` or a GFM-compatible variant for future HTML-to-Markdown import/paste cleanup.
  - `electron-store` or an equivalent typed wrapper for app preferences and window/session state.
- Feature candidates worth preserving for post-foundation planning:
  - focus mode
  - typewriter mode
  - fast workspace search
  - export to HTML and PDF
  - KaTeX math blocks
  - Mermaid diagrams
  - YAML frontmatter handling
  - emoji support
  - spellcheck
  - external file-change detection with clear conflict handling

## Phase 0: Project Foundation

- [x] Initialize a `pnpm` workspace.
- [x] Create the main workspace packages:
  - [x] `apps/desktop`
  - [x] `packages/core`
  - [x] `packages/editor`
  - [x] `packages/ui`
- [x] Configure TypeScript project references or workspace-level TypeScript settings.
- [x] Add shared linting and formatting configuration.
- [x] Add a root README with the product goal, local-first constraints, and development commands.
- [x] Add basic CI for typecheck, tests, and build.
- [x] Choose and document the initial license.

## Phase 1: Desktop Shell

- [x] Scaffold the Electron app with Electron Forge and Vite.
- [x] Add Radix Primitives as the base renderer UI primitive layer.
- [x] Establish app theme tokens and initial `system` / `light` / `dark` shell support.
- [x] Convert the desktop window to a custom title bar / frameless shell.
- [x] Create Electron entry points:
  - [x] main process
  - [x] preload script
  - [x] renderer app
- [x] Configure secure Electron defaults:
  - [x] `contextIsolation: true`
  - [x] `nodeIntegration: false`
  - [x] preload-only IPC surface
- [x] Implement title-bar drag regions and platform-aware window controls.
- [x] Implement the initial app window.
- [x] Add app menu commands for:
  - [x] Open File
  - [x] Open Folder
  - [x] Save
  - [x] Save As
  - [x] Toggle Rich/Source Mode
- [x] Add development launch command.
- [x] Add production build command.

## Phase 1.1: Visual Design Foundation

- [x] Define the visual direction for Pluma as a desktop-first writing and editing tool with a VS Code-inspired shell structure.
- [x] Define the typography system for app chrome, metadata, and document-adjacent UI.
- [x] Define semantic color tokens for surfaces, text, borders, accents, warnings, and status states.
- [x] Define spacing, density, radius, and elevation rules for desktop UI surfaces.
- [x] Define the base component language for custom title bar, toolbar, sidebar, panels, menus, status bar, and empty states.
- [x] Define interaction states for hover, focus, selected, active, disabled, and keyboard navigation.
- [x] Define how Radix primitives are styled inside the Pluma design system.
- [x] Produce reference designs for:
  - [x] empty state
  - [x] file-opened state
  - [x] folder/workspace state
  - [x] warning and status state
- [x] Define the status-bar metric model for word count, line count, mode, and save state.
- [x] Document design-token usage rules for implementation.

## Phase 2: Shared UI And Core File Foundations

- [x] Create `packages/ui` for shared renderer app UI that can be reused by desktop and a future web app.
- [x] Define the `packages/ui` boundary so it contains shared React app UI and theme behavior, but no Electron-only imports.
- [x] Extract the desktop renderer shell layout, sidebar, title bar content, status bar, and shared empty-state surfaces into `packages/ui`.
- [x] Add `allotment`-based shared pane primitives to `packages/ui` for sidebar, editor, and future secondary-pane layouts.
- [x] Add a shared custom tab strip to `packages/ui` for open documents, including active, inactive, close, and dirty states.
- [x] Add `dnd-kit`-based tab reordering to the shared tab strip.
- [x] Define shared file-location types for desktop paths and future browser handles.
- [x] Define `FileSystemAdapter`.
- [x] Define `DocumentSession`.
- [x] Define `MarkdownPipeline`.
- [x] Define save and conflict result types.
- [x] Implement `DesktopFileSystemAdapter`.
- [x] Implement atomic writes using temp-file plus rename.
- [x] Track file metadata needed for conflict detection.
- [x] Add unit tests for the filesystem adapter behavior.

## Phase 3: File Opening And Workspace Browsing

- [x] Implement Open File flow.
- [x] Implement Open Folder flow.
- [x] Add Markdown file tree for opened folders using `Headless Tree`.
- [x] Move workspace tree, title-area workspace presentation, and status-bar UI to shared `packages/ui` components where they do not depend on Electron APIs.
- [x] Apply the Pluma design system to the file tree, workspace browsing layout, title bar workspace label, and file-selection states.
- [x] Build the workspace shell on `allotment` so sidebar and editor panes resize like a desktop editor.
- [x] Replace the placeholder tab row with the shared `packages/ui` tab strip and wire tab ordering into document/workspace state.
- [x] Support selecting files from the tree.
- [x] Hydrate `DocumentSession` instances from selected files and opened tabs.
- [x] Handle relative links and image references against the active file path.
- [x] Implement macOS `open-file` event handling.
- [x] Keep Windows/Linux launch-argument file handling as future-safe desktop infrastructure.
- [x] Implement `second-instance` routing for files opened while Pluma is already running.
- [x] Add smoke tests or manual QA steps for file association flows.

## Phase 4: Markdown Analysis And Safety

- [x] Add Markdown parsing with:
  - [x] `remark-parse`
  - [x] `remark-gfm`
  - [x] `remark-frontmatter`
- [x] Evaluate `dompurify` before any user-authored Markdown is rendered as HTML.
- [x] Evaluate `github-markdown-css` as a compatibility reference for preview defaults.
- [x] Implement Markdown capability analysis.
- [x] Detect whether a document is eligible for rich mode.
- [x] Implement a round-trip guard for rich-mode saves.
- [x] Define unsupported or unsafe syntax behavior.
- [x] Add fixture tests for:
  - [x] CommonMark basics
  - [x] GFM tables
  - [x] task lists
  - [x] fenced code blocks
  - [x] YAML frontmatter
  - [x] relative links and images
  - [x] unsupported syntax that must not be destroyed

## Phase 5: Source Editor

- [x] Add CodeMirror 6 wrapper in `packages/editor`.
- [x] Apply the Pluma design system to source-mode chrome and controls.
- [x] Theme CodeMirror through Pluma theme tokens and supported syntax palettes.
- [x] Configure Markdown language support.
- [x] Add editor commands for common Markdown actions.
- [x] Add source editor state synchronization with `DocumentSession`.
- [x] Add keyboard shortcuts for save and mode switching.
- [ ] Add source-mode tests for editing and session updates.

## Phase 6: Rich Editor

- [x] Add Milkdown wrapper in `packages/editor`.
- [x] Apply the Pluma design system to rich-mode chrome and controls.
- [x] Theme Milkdown through Pluma theme tokens for light and dark modes.
- [x] Enable CommonMark support.
- [x] Enable GFM support.
- [x] Add basic rich editing controls through Crepe's built-in floating toolbar, top bar, block menu, and block handles for:
  - [x] heading levels
  - [x] bold
  - [x] italic
  - [x] strikethrough
  - [x] inline code
  - [x] bullet list
  - [x] ordered list
  - [x] task list
  - [x] blockquote
  - [x] fenced code block
  - [x] table insertion
  - [x] link insertion
  - [x] image link insertion
- [x] Synchronize Milkdown output back to `DocumentSession`.
- [x] Block rich-mode save when the round-trip guard fails.
- [x] Route unsupported documents to source mode with preview.
- [x] Add tests for rich/source switching without content loss.

## Phase 7: Pluma Markdown Formatter And Linting

- [x] Define Pluma Markdown as CommonMark + GFM + YAML frontmatter in project docs.
- [x] Add canonical formatting for rich-mode Markdown output.
- [x] Use Prettier as the formatter with explicit Markdown options:
  - [x] `parser: "markdown"`
  - [x] `proseWrap: "preserve"`
  - [x] stable line endings
- [x] Preserve Pluma source conventions after formatting:
  - [x] dash bullets for unordered lists and task lists
  - [x] tight task lists unless the user intentionally creates multi-paragraph items
  - [x] fenced code blocks
  - [x] GFM tables
  - [x] YAML frontmatter
- [x] Run formatted rich-mode output through the round-trip guard before storing or saving.
- [x] Keep source-mode editing unformatted during typing.
- [x] Add an explicit source-mode "Format Document" command or defer it behind a setting.
- [x] Add fixture tests for formatting:
  - [x] task lists do not gain blank lines between items
  - [x] task list markers remain `- [ ]` and `- [x]`
  - [x] bullet and ordered lists remain stable
  - [x] tables remain valid GFM
  - [x] frontmatter remains at the top of the document
  - [x] fenced code blocks preserve language info
  - [x] unsupported HTML is not rewritten through rich mode
- [x] Add markdownlint as a diagnostics and CI policy layer.
- [x] Decide which markdownlint rules are warnings vs fixable checks.
- [x] Document that Prettier owns formatting and markdownlint owns style diagnostics.

## Phase 8: Autosave And Conflict Handling

- [x] Persist desktop session identity across app launches:
  - [x] open document paths
  - [x] active document path
  - [x] workspace folder path
  - [x] editor mode
  - [x] sidebar/editor pane sizes
- [x] Persist desktop settings in `settings.json`:
  - [x] theme preference
- [x] Implement autosave debounce.
- [x] Persist changes through `writeTextAtomic`.
- [x] Show save state in the UI.
- [x] Apply the Pluma design system to save, autosave, conflict, external-change, and status-bar metric states.
- [x] Evaluate `chokidar` for active-file and folder watching.
- [x] Watch active files for external changes.
- [x] Watch opened folders for file tree changes.
- [x] Detect external modification before saving.
- [x] Preserve in-memory edits when a conflict occurs.
- [x] Add conflict UI with actions:
  - [x] reload from disk
  - [x] keep editing
  - [x] compare manually
- [x] Add tests for autosave, atomic save, and external modification detection.

## Phase 8.5: Functional Hardening Before Polish

- [x] Protect dirty, saving, and conflicted documents before closing tabs.
- [x] Protect dirty, saving, and conflicted documents before quitting the app.
- [x] Confirm before reloading from disk when in-memory edits would be discarded.
- [x] Decide whether `Save As` belongs in MVP:
  - [x] implement `Save As` for desktop files and untitled/new documents, or
  - [ ] remove or disable the visible `Save As` menu item until it is supported.
- [x] Replace the placeholder compare action:
  - [ ] implement a minimal manual compare flow, or
  - [x] rename/remove `Compare Manually` so it does not imply an unavailable feature.
- [x] Make autosave failures durable in document state instead of status-only messaging.
- [x] Validate folder watcher behavior on supported platforms:
  - [x] document macOS-only assumptions for recursive watching, or
  - [ ] add a fallback for platforms where recursive `fs.watch` is unavailable.
- [x] Decide whether new file creation is part of MVP:
  - [x] wire sidebar new-file action and untitled document save flow, or
  - [ ] remove or disable create controls until supported.
- [x] Confirm standalone-file behavior while a workspace is open.
- [ ] Run a manual desktop smoke test for autosave, conflicts, reload, keep-editing, close protection, and workspace refresh.

## Phase 9: MVP UI Polish

- [ ] Finalize light and dark theme polish across shell, sidebar, editor chrome, and status surfaces.
- [ ] Verify consistency of the implemented design system across all major UI surfaces.
- [x] Refine the custom title bar, sidebar layout, top-right utility actions, and status bar for dense desktop use.
- [x] Refine layout, spacing, and alignment details across the app.
- [x] Refine motion and interaction polish where it improves usability.
- [ ] Verify keyboard navigation for core flows.
- [x] Verify text does not overflow controls across common window sizes.
- [x] Keep the UI quiet, dense, and document-focused.

## Phase 9.1: Post-Foundation Feature Candidates

- [ ] Evaluate fast workspace search with `@vscode/ripgrep`.
- [ ] Evaluate multi-window desktop support:
  - [ ] keep Pluma as a single Electron app instance with multiple `BrowserWindow`s.
  - [ ] introduce a per-window session/controller for documents, active tab, workspace, pane sizes, autosave timers, and file watchers.
  - [ ] route IPC commands by sender window instead of using one global active document/session.
  - [ ] add `File > New Window` and define whether opened files reuse the active window or create a new window.
  - [ ] protect unsaved changes per window and during app-wide quit across all open windows.
  - [ ] decide whether session restore should restore one previous window or all previous windows.
- [ ] Evaluate focus mode.
- [ ] Evaluate typewriter mode.
- [ ] Evaluate spellcheck using Electron's built-in spellchecker before adding native spellcheck dependencies.
- [ ] Evaluate KaTeX math rendering.
- [ ] Evaluate Mermaid diagram rendering.
- [ ] Evaluate emoji support.
- [ ] Evaluate HTML export.
- [ ] Evaluate PDF export.
- [ ] Evaluate HTML-to-Markdown import or paste cleanup with `turndown` or a GFM-compatible alternative.
- [ ] Evaluate Edit menu additions once the editor supports them:
  - [ ] copy as rich text
  - [ ] copy as HTML
  - [ ] duplicate selection or block
  - [ ] create/delete paragraph commands
  - [ ] find, find next, find previous, replace, and find in folder
  - [ ] screenshot capture
  - [ ] line ending selection
  - [ ] Emoji & Symbols native menu support

## Phase 10: Packaging And Distribution

- [ ] Configure app metadata:
  - [ ] app name
  - [ ] bundle identifiers
  - [ ] icons
  - [ ] copyright/license metadata
- [ ] Configure Electron Forge makers for macOS DMG/ZIP.
- [ ] Defer Windows installer and Linux DEB packaging to post-MVP.
- [ ] Register macOS `.md` file association.
- [ ] Add signing/notarization placeholders and documentation.
- [ ] Configure GitHub Releases publishing path.
- [ ] Add manual release checklist.
- [ ] Verify packaged app launch on macOS.
- [ ] Verify double-clicking `.md` opens the file in Pluma.

## Phase 11: Future Browser Path

- [ ] Keep browser-specific work out of the MVP runtime.
- [ ] Document the planned `BrowserFileSystemAdapter`.
- [ ] Document expected File System Access API limitations.
- [ ] Define fallback behavior for browsers without direct file editing support.
- [ ] Keep core packages free of Electron-only imports.
- [x] Keep `packages/ui` free of Electron-only imports so the app UI can be reused in a browser shell.
- [ ] Add architecture notes for sharing editor and core code between desktop and browser.

## MVP Acceptance Criteria

- [ ] A user can open a `.md` file directly in Pluma.
- [ ] A user can open a folder and browse Markdown files.
- [ ] A user can edit supported Markdown in rich mode.
- [ ] A user can edit any Markdown file in source mode.
- [ ] Autosave writes normal Markdown text back to disk.
- [ ] Unsupported Markdown is not silently destroyed.
- [ ] External file changes are detected and surfaced.
- [ ] The packaged app can be installed and launched on macOS.
- [ ] macOS `.md` file association works in packaged builds.

## Known Risks

- [ ] Rich editing can normalize Markdown formatting. Mitigation: source text remains canonical and rich-mode saves require a round-trip safety check.
- [ ] Unsupported Markdown may be common in technical docs. Mitigation: source mode and preview remain first-class.
- [ ] Electron bundles are large. Mitigation: accept for MVP; revisit Tauri only if adoption or performance data justifies it.
- [ ] Browser local-file editing is not universally supported. Mitigation: design shared core now and treat browser support as Chromium-first until fallback flows are defined.
- [ ] Cross-platform packaging remains future work. Mitigation: keep core, UI, and desktop launch handling portable, but validate only macOS for MVP.
