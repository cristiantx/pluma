# Pluma Implementation Plan

Pluma is an open-source, local-first Markdown editor. The MVP should feel polished and approachable while keeping Markdown files as normal files on disk. The desktop app is the first target, with architecture shaped so a future browser version can reuse the core document and filesystem abstractions.

## Guiding Decisions

- [ ] Use Electron, React, TypeScript, Vite, and Electron Forge for the desktop MVP.
- [ ] Use Radix Primitives for renderer UI primitives that are not provided by the OS shell.
- [ ] Support semantic app theming with `system`, `light`, and `dark` modes.
- [ ] Use a custom title bar and frameless desktop shell with a VS Code-inspired workspace layout.
- [ ] Keep Markdown source text as the canonical document format.
- [ ] Use Milkdown for rich Markdown editing when a document is safe for rich mode.
- [ ] Use CodeMirror 6 for source mode.
- [ ] Treat source mode as a first-class editor, not just an escape hatch.
- [ ] Preserve unsupported Markdown by avoiding destructive rich-mode saves.
- [ ] Support direct `.md` file opening and folder-based Markdown browsing.
- [ ] Defer accounts, sync, cloud storage, servers, plugins, auto-update, and pasted-image asset management.

## Phase 0: Project Foundation

- [x] Initialize a `pnpm` workspace.
- [x] Create the main workspace packages:
  - [x] `apps/desktop`
  - [x] `packages/core`
  - [x] `packages/editor`
- [x] Configure TypeScript project references or workspace-level TypeScript settings.
- [x] Add shared linting and formatting configuration.
- [x] Add a root README with the product goal, local-first constraints, and development commands.
- [x] Add basic CI for typecheck, tests, and build.
- [x] Choose and document the initial license.

## Phase 1: Desktop Shell

- [x] Scaffold the Electron app with Electron Forge and Vite.
- [x] Add Radix Primitives as the base renderer UI primitive layer.
- [x] Establish app theme tokens and initial `system` / `light` / `dark` shell support.
- [ ] Convert the desktop window to a custom title bar / frameless shell.
- [x] Create Electron entry points:
  - [x] main process
  - [x] preload script
  - [x] renderer app
- [x] Configure secure Electron defaults:
  - [x] `contextIsolation: true`
  - [x] `nodeIntegration: false`
  - [x] preload-only IPC surface
- [ ] Implement title-bar drag regions and platform-aware window controls.
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

## Phase 2: Shared Core Interfaces

- [ ] Define shared file-location types for desktop paths and future browser handles.
- [ ] Define `FileSystemAdapter`.
- [ ] Define `DocumentSession`.
- [ ] Define `MarkdownPipeline`.
- [ ] Define save and conflict result types.
- [ ] Implement `DesktopFileSystemAdapter`.
- [ ] Implement atomic writes using temp-file plus rename.
- [ ] Track file metadata needed for conflict detection.
- [ ] Add unit tests for the filesystem adapter behavior.

## Phase 3: Markdown Analysis And Safety

- [ ] Add Markdown parsing with:
  - [ ] `remark-parse`
  - [ ] `remark-gfm`
  - [ ] `remark-frontmatter`
- [ ] Implement Markdown capability analysis.
- [ ] Detect whether a document is eligible for rich mode.
- [ ] Implement a round-trip guard for rich-mode saves.
- [ ] Define unsupported or unsafe syntax behavior.
- [ ] Add fixture tests for:
  - [ ] CommonMark basics
  - [ ] GFM tables
  - [ ] task lists
  - [ ] fenced code blocks
  - [ ] YAML frontmatter
  - [ ] relative links and images
  - [ ] unsupported syntax that must not be destroyed

## Phase 4: Source Editor

- [ ] Add CodeMirror 6 wrapper in `packages/editor`.
- [ ] Apply the Pluma design system to source-mode chrome and controls.
- [ ] Theme CodeMirror through Pluma theme tokens and supported syntax palettes.
- [ ] Configure Markdown language support.
- [ ] Add editor commands for common Markdown actions.
- [ ] Add source editor state synchronization with `DocumentSession`.
- [ ] Add keyboard shortcuts for save and mode switching.
- [ ] Add source-mode tests for editing and session updates.

## Phase 5: Rich Editor

- [ ] Add Milkdown wrapper in `packages/editor`.
- [ ] Apply the Pluma design system to rich-mode chrome and controls.
- [ ] Theme Milkdown through Pluma theme tokens for light and dark modes.
- [ ] Enable CommonMark support.
- [ ] Enable GFM support.
- [ ] Add basic rich editing controls for:
  - [ ] heading levels
  - [ ] bold
  - [ ] italic
  - [ ] strikethrough
  - [ ] inline code
  - [ ] bullet list
  - [ ] ordered list
  - [ ] task list
  - [ ] blockquote
  - [ ] fenced code block
  - [ ] table insertion
  - [ ] link insertion
  - [ ] image link insertion
- [ ] Synchronize Milkdown output back to `DocumentSession`.
- [ ] Block rich-mode save when the round-trip guard fails.
- [ ] Route unsupported documents to source mode with preview.
- [ ] Add tests for rich/source switching without content loss.

## Phase 6: File Opening And Workspace Browsing

- [ ] Implement Open File flow.
- [ ] Implement Open Folder flow.
- [ ] Add Markdown file tree for opened folders.
- [ ] Apply the Pluma design system to the file tree, workspace browsing layout, title bar workspace label, and file-selection states.
- [ ] Support selecting files from the tree.
- [ ] Handle relative links and image references against the active file path.
- [ ] Implement macOS `open-file` event handling.
- [ ] Implement Windows/Linux launch-argument file handling.
- [ ] Implement `second-instance` routing for files opened while Pluma is already running.
- [ ] Add smoke tests or manual QA steps for file association flows.

## Phase 7: Autosave And Conflict Handling

- [ ] Implement autosave debounce.
- [ ] Persist changes through `writeTextAtomic`.
- [ ] Show save state in the UI.
- [ ] Apply the Pluma design system to save, autosave, conflict, external-change, and status-bar metric states.
- [ ] Watch active files for external changes.
- [ ] Watch opened folders for file tree changes.
- [ ] Detect external modification before saving.
- [ ] Preserve in-memory edits when a conflict occurs.
- [ ] Add conflict UI with actions:
  - [ ] reload from disk
  - [ ] keep editing
  - [ ] compare manually
- [ ] Add tests for autosave, atomic save, and external modification detection.

## Phase 8: MVP UI Polish

- [ ] Finalize light and dark theme polish across shell, sidebar, editor chrome, and status surfaces.
- [ ] Verify consistency of the implemented design system across all major UI surfaces.
- [ ] Refine the custom title bar, sidebar layout, top-right utility actions, and status bar for dense desktop use.
- [ ] Refine layout, spacing, and alignment details across the app.
- [ ] Refine motion and interaction polish where it improves usability.
- [ ] Verify keyboard navigation for core flows.
- [ ] Verify text does not overflow controls across common window sizes.
- [ ] Keep the UI quiet, dense, and document-focused.

## Phase 9: Packaging And Distribution

- [ ] Configure app metadata:
  - [ ] app name
  - [ ] bundle identifiers
  - [ ] icons
  - [ ] copyright/license metadata
- [ ] Configure Electron Forge makers:
  - [ ] macOS DMG/ZIP
  - [ ] Windows installer
  - [ ] Linux DEB
- [ ] Register `.md` file association.
- [ ] Add signing/notarization placeholders and documentation.
- [ ] Configure GitHub Releases publishing path.
- [ ] Add manual release checklist.
- [ ] Verify packaged app launch on each target OS.
- [ ] Verify double-clicking `.md` opens the file in Pluma.

## Phase 10: Future Browser Path

- [ ] Keep browser-specific work out of the MVP runtime.
- [ ] Document the planned `BrowserFileSystemAdapter`.
- [ ] Document expected File System Access API limitations.
- [ ] Define fallback behavior for browsers without direct file editing support.
- [ ] Keep core packages free of Electron-only imports.
- [ ] Add architecture notes for sharing editor and core code between desktop and browser.

## MVP Acceptance Criteria

- [ ] A user can open a `.md` file directly in Pluma.
- [ ] A user can open a folder and browse Markdown files.
- [ ] A user can edit supported Markdown in rich mode.
- [ ] A user can edit any Markdown file in source mode.
- [ ] Autosave writes normal Markdown text back to disk.
- [ ] Unsupported Markdown is not silently destroyed.
- [ ] External file changes are detected and surfaced.
- [ ] The packaged app can be installed and launched on macOS, Windows, and Linux.
- [ ] `.md` file association works in packaged builds.

## Known Risks

- [ ] Rich editing can normalize Markdown formatting. Mitigation: source text remains canonical and rich-mode saves require a round-trip safety check.
- [ ] Unsupported Markdown may be common in technical docs. Mitigation: source mode and preview remain first-class.
- [ ] Electron bundles are large. Mitigation: accept for MVP; revisit Tauri only if adoption or performance data justifies it.
- [ ] Browser local-file editing is not universally supported. Mitigation: design shared core now and treat browser support as Chromium-first until fallback flows are defined.
- [ ] Cross-platform file association behavior is platform-specific. Mitigation: test packaged builds on all target OSes before release.
