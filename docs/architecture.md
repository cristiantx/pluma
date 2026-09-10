# Architecture

Pluma is a local-first desktop Markdown editor. The codebase is organized as a
small monorepo so the desktop app, editor integrations, shared UI, and Markdown
domain logic can evolve independently.

## Workspace Layout

- `apps/desktop`: Electron app, native menus, dialogs, IPC, file watching,
  persistence, and release packaging.
- `packages/core`: Markdown, document-session, filesystem, export, and
  file-location domain logic.
- `packages/commands`: Dependency-free command definitions, availability,
  request parsing, and platform shortcut conversion.
- `packages/editor`: Draftly and CodeMirror editor integrations.
- `packages/ui`: Shared React desktop shell, styling, shell state, and renderer
  adapters.
- `docs`: Durable project documentation for contributors and maintainers.

The desktop app owns operating-system integration. Shared packages should stay
free of Electron-specific windowing, dialogs, menus, and IPC glue unless a type
is explicitly designed as a desktop adapter contract.

## Data Flow

1. Electron menus, dialogs, filesystem events, and IPC originate in
   `apps/desktop`.
2. Main sends a full shell snapshot at bootstrap, then focused document, tab,
   workspace, layout, settings, status, and baseline-reset events.
3. The renderer bridge hydrates the matching Zustand slices. Shell components
   read narrow selectors from that store.
4. A retained editor-session controller owns CodeMirror history, selections,
   and scroll state while views remount or documents become inactive.
5. Markdown capability analysis runs in a dedicated worker. Markdown and
   document rules remain in `packages/core`.

This keeps platform integration explicit while preserving reusable core and UI
boundaries.

## Renderer State

The shared renderer store lives in `packages/ui/src/state`.

- `commands`: renderer-facing handlers for document and shell actions.
- `theme`: user preference, resolved theme, and current system dark-mode signal.
- `workspace`: current workspace label, path, explorer nodes, and preload bridge
  availability.
- `tabs`: open-document tabs, active tab id, tab reorder, and close behavior.
- `status`: actionable notifications; routine success messages stay silent.

The shared command package is the source for command IDs, payloads,
availability, and platform shortcut metadata. Desktop menus, IPC adapters, and
editor bindings translate those definitions into their local runtime. Native
Electron roles remain separate so focused text controls retain platform
behavior. Pending editor text is flushed before dependent native operations.

The desktop main process is split by responsibility:

- `windows/windowSessionState.ts` owns each window's live shell and document
  collection; `windowShellPublisher.ts` publishes bootstrap snapshots and
  incremental events.
- `documents/` owns opening, tabs, modes, text updates, saving, drafts,
  reconciliation, explicit reloads, closing, and file operations. Window export
  coordination lives in `export/windowDocumentExport.ts`. Shared self-write
  tracking lives in `persistence/selfWriteTracking.ts`; desktop-save suppression
  is released even when an atomic write throws.
- `workspace/windowWorkspaceCoordinator.ts` owns scans, watching, and search;
  `windowWorkspaceActions.ts` owns validated workspace commands.
- `session/windowSessionRestoration.ts` merges progressive restore results with
  live opens and closes. Restoration stops publishing after disposal or a
  workspace switch. `desktopQuitCoordinator.ts` coalesces quit requests and
  orders flush, protection, session persistence, and exit; persistence failure
  is reported and a later quit can retry.
- `settings/desktopSettingsController.ts` serializes settings writes and their
  renderer, spellcheck, workspace, autosave, and menu effects.
- `runtime/desktopAppLifecycle.ts`, `openTargetQueue.ts`, and
  `windows/windowSessionLifecycle.ts` own app and window lifecycle wiring.
- `commands/desktopCommandDispatcher.ts` and `ipc/desktopIpcBindings.ts` adapt
  validated `@pluma/commands` requests to the trusted focused or sender window.
  `windowContextCommands.ts` revalidates captured tab and workspace targets.
  Renderer commands, including reload, follow the same descriptor-backed
  availability rules as native menu commands.

`DesktopWindowSession` composes per-window services, and
`desktopMainController` composes application-wide services. Both delegate
feature behavior to the focused modules above; `main.ts` remains the thin
entrypoint.

The store coordinates UI state. Product rules, Markdown behavior, save logic,
and file abstractions belong in `packages/core`.

## Contribution Boundaries

- Keep `apps/desktop/src/main.ts` thin. Add main-process behavior under explicit
  folders such as `ipc`, `menus`, `dialogs`, `workspace`, `watching`,
  `persistence`, `session`, or `windows`.
- Keep React component files focused, named with `PascalCase.tsx`, and exported
  with named exports.
- Keep hooks, adapters, state modules, and view helpers in focused
  `camelCase.ts` files.
- Prefer feature-local helpers and tests over broad generic buckets.
- Avoid source files growing beyond roughly 300 lines without looking for a
  clear responsibility split.
