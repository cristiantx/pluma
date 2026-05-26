# Pluma Original Plan

## Summary

Build Pluma as an Electron + TypeScript + React desktop app with a shared core so a future browser version can reuse document, parsing, and file-session logic. For the editor engine, use Milkdown, based on ProseMirror and Remark, for rich Markdown editing and CodeMirror 6 for source mode. Keep the file on disk as plain `.md`; no database, no sync layer, no server.

Choose Electron for the MVP because it gives predictable cross-platform file opening, packaging, and OS integration now. Revisit Tauri later only if bundle size or startup time becomes a real product problem.

## Key Changes

### 1. App Architecture

- Use a small monorepo from day one:
  - `apps/desktop`: Electron shell, packaging, OS integration
  - `packages/core`: document session model, Markdown pipeline, save/conflict logic, shared types
  - `packages/editor`: rich editor wrapper, source editor wrapper, editor commands
- Use `pnpm` workspaces with hoisted `node_modules` config so Electron Forge packaging works cleanly.
- Keep all filesystem access behind a shared adapter boundary:
  - `FileSystemAdapter`
  - `DesktopFileSystemAdapter` now
  - `BrowserFileSystemAdapter` later

### 2. Editor Engine And UX

- Rich mode is primary; source mode is always available and first-class.
- Use Milkdown as the rich editor base because it is Markdown-oriented and already sits on ProseMirror + Remark, with CommonMark/GFM support.
- Use CodeMirror 6 for source mode.
- Support these as first-class rich-editable syntax in the MVP:
  - headings
  - paragraphs
  - bold / italic / inline code
  - blockquotes
  - bullet/ordered lists
  - task lists
  - fenced code blocks
  - tables
  - links
  - images as file links
  - thematic breaks
  - YAML frontmatter as raw text block/panel
- Do not implement Notion-style databases, slash-command extensibility, embeds, collaboration, or pasted-image asset copying in the MVP.

### 3. Markdown Round-Tripping Strategy

- Disk format remains the single source of truth: plain Markdown text.
- Parse Markdown with a shared pipeline based on `remark-parse`, `remark-gfm`, and `remark-frontmatter`.
- Convert supported nodes into rich editor nodes.
- Convert unsupported constructs into opaque raw blocks that preserve their original source text exactly.
- Track edits at the top-level block level:
  - unchanged blocks serialize back to their original source slice
  - changed supported blocks serialize from the structured model
  - raw blocks always emit their original text unless edited in source mode
- If a document contains unsupported syntax, rich mode still opens it, but unsupported regions are non-destructive raw blocks.
- Exact editing of unsupported regions happens in source mode.
- If serialization would lose fidelity, block save and route the user to source mode for that document.

### 4. File Handling Model

- `DocumentSession` owns:
  - absolute path
  - current raw text
  - parsed block map
  - rich/source capability flags
  - dirty state
  - last-known `mtime`
  - external-change state
- Opening behavior:
  - macOS: handle Electron `open-file` early
  - Windows/Linux: parse launch args and `second-instance` events
  - if app is already running, route new file opens into the existing instance
- Saving behavior:
  - autosave with short debounce
  - write atomically via temp file + rename
  - compare `mtime` before write
  - if file changed externally, preserve in-memory edits and prompt to reload/compare
- Workspace behavior:
  - support opening a single file
  - support opening a folder of Markdown files with a sidebar tree
  - watch the active file and open folder for external changes

### 5. Packaging And Release Approach

- Use Electron Forge + Vite + TypeScript.
- Initial release artifacts:
  - macOS: signed `.dmg` + zip
  - Windows: signed installer
  - Linux: `.deb` first, with other formats later
- Register file associations for `.md` in the MVP.
- Extend to `.markdown` and related variants after the first release if needed.
- Defer auto-update to post-MVP.
- Shape the release pipeline so GitHub Releases can add auto-update later without restructuring.

## Public Interfaces / Types

### FileSystemAdapter

- `openFile()`
- `openDirectory()`
- `readText(path | handle)`
- `writeTextAtomic(path | handle, text, expectedMtime?)`
- `watchFile(...)`
- `watchDirectory(...)`

### DocumentSession

- `id`
- `location`
- `rawText`
- `blocks`
- `mode`
- `dirty`
- `lastSavedMtimeMs`
- `externalChange`

### MarkdownPipeline

- `parse(rawText)`
- `toEditorModel(parsedDoc)`
- `serialize(session)`
- `detectUnsupported(parsedDoc)`
- `fidelityCheck(before, after)`

## Test Plan

- Fixture tests for round-trip:
  - plain paragraphs/headings
  - GFM tables/tasks
  - YAML frontmatter
  - mixed supported + unsupported syntax
  - untouched unsupported blocks stay byte-stable
  - edited supported block changes only local output, not the whole file
- File/session tests:
  - autosave debounce
  - atomic save
  - external edit conflict prompt
  - open-on-launch and open-in-existing-instance
- UI smoke tests:
  - open `.md` by path
  - switch rich/source without content loss
  - folder sidebar navigation
  - relative image/link rendering
- Packaging checks:
  - file association works on packaged builds
  - signed artifacts launch on each target OS

## Risks And Defaults

- Main risk: rich editing vs exact Markdown fidelity. Mitigation: conservative supported subset, raw blocks for unknown syntax, source mode fallback, fixture-heavy round-trip tests.
- Secondary risk: Electron app size. Accept for the MVP; revisit Tauri only if it becomes a real adoption problem.
- Future web risk: browser File System Access picker APIs are still not uniformly available across major browsers, so the future web version should be designed as Chromium-first for direct file editing, with import/export fallback elsewhere.
- Frontmatter is editable as text in the MVP, not as a schema-driven metadata form.
- Images are link-only in the MVP; no asset import pipeline yet.
- No plugin system in the MVP.
- No cloud sync, no account model, no local database beyond app preferences and window state.

## Decision Basis

- Electron app lifecycle and file-open handling: https://www.electronjs.org/docs/latest/api/app
- Electron Forge packaging and makers: https://www.electronforge.io/
- Milkdown overview and GFM support: https://milkdown.dev/
- Tiptap Markdown docs note the Markdown extension is beta: https://tiptap.dev/docs/editor/markdown
- Tauri tradeoffs and prerequisites: https://v2.tauri.app/start/
- MDN File System Access API picker support: https://developer.mozilla.org/docs/Web/API/Window/showOpenFilePicker
- MDN Origin Private File System overview: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
