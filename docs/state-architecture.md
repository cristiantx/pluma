# State Architecture

Pluma now uses a shared typed Zustand store for renderer-level coordination.

## Why Zustand

- The shell had started accumulating prop drilling for tabs, theme, workspace labels, shell commands, and status metrics.
- The desktop app needs a single coordination layer that the shared UI package can read directly.
- Zustand is small enough for a desktop shell, while still letting us keep `packages/core` as the domain layer.

## Current Store Shape

The shared store lives in `packages/ui/src/state`.

- `commands`
  - Typed command handlers for shell actions such as `openFile`, `openFolder`, and `toggleMode`.
- `theme`
  - User preference (`system | light | dark`)
  - Resolved theme
  - Current system dark-mode signal
- `workspace`
  - Current workspace label and path
  - Sidebar explorer nodes
  - Preload-bridge availability
- `tabs`
  - Open-document tabs
  - Active tab id
  - Reorder and close actions
- `status`
  - Status bar metrics shared by the shell

## Ownership Boundaries

- `packages/core`
  - Domain types and product logic
  - File locations, document sessions, save/conflict behavior
- `packages/ui`
  - Shared renderer store
  - Shell presentation components
  - Shared tab, sidebar, and status UI
- `apps/desktop`
  - Electron windowing, preload, menus, dialogs, and IPC
  - Bridge code that converts Electron events into store snapshots

The store is an app-coordination layer, not a replacement for domain logic in `packages/core`.

## Data Flow

1. Electron or preload emits shell events.
2. `apps/desktop/src/App.tsx` reduces those events into shell state.
3. The app derives a `PlumaShellSnapshot`.
4. The snapshot hydrates the Zustand store in `@pluma/ui`.
5. Shared shell components read narrow selectors from the store.

This keeps the desktop app focused on OS integration while the shared shell remains platform-neutral.

## Typed Slice Rules

- Every slice has explicit exported types.
- Shared UI components should subscribe with narrow selectors, not broad store reads.
- Local transient concerns still stay local when they do not need cross-shell coordination.
- Future editor-engine objects should stay out of the store unless coordination requires them.

## Near-Term Expansion

The current store covers shell coordination. Later phases can add:

- `editor`
  - Rich/source mode
  - Active document session linkage
- `ui`
  - Pane visibility and pane sizes
  - Secondary inspector state
- `workspace`
  - Real tree expansion, selection, and filesystem-backed items

Those additions should stay typed and slice-based under the same shared store.
