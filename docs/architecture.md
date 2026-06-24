# Architecture

Pluma is a local-first desktop Markdown editor. The codebase is organized as a
small monorepo so the desktop app, editor integrations, shared UI, and Markdown
domain logic can evolve independently.

## Workspace Layout

- `apps/desktop`: Electron app, native menus, dialogs, IPC, file watching,
  persistence, and release packaging.
- `packages/core`: Markdown, document-session, filesystem, export, and
  file-location domain logic.
- `packages/editor`: Draftly and CodeMirror editor integrations.
- `packages/ui`: Shared React desktop shell, styling, shell state, and renderer
  adapters.
- `docs`: Durable project documentation for contributors and maintainers.

The desktop app owns operating-system integration. Shared packages should stay
free of Electron-specific windowing, dialogs, menus, and IPC glue unless a type
is explicitly designed as a desktop adapter contract.

## Data Flow

1. Electron menus, dialogs, filesystem events, and preload events originate in
   `apps/desktop`.
2. The desktop renderer bridge reduces those events into shell snapshots.
3. `packages/ui` hydrates its shared Zustand store from those snapshots.
4. Shell components read narrow selectors from the store.
5. Markdown and document behavior stays in `packages/core`.

This keeps platform integration explicit while preserving reusable core and UI
boundaries.

## Renderer State

The shared renderer store lives in `packages/ui/src/state`.

- `commands`: typed shell actions such as opening files, opening folders, and
  toggling editor mode.
- `theme`: user preference, resolved theme, and current system dark-mode signal.
- `workspace`: current workspace label, path, explorer nodes, and preload bridge
  availability.
- `tabs`: open-document tabs, active tab id, tab reorder, and close behavior.
- `status`: shell metrics and status text shared by the renderer.

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
