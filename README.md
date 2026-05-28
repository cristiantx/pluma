# Pluma

![Pluma logo](./docs/assets/pluma.svg)

Pluma is an open-source, local-first Markdown editor. Markdown files stay as normal files on disk, and the desktop app is being structured so a future browser version can reuse the same core document and filesystem abstractions.

## Current Scope

- Desktop-first MVP built as a monorepo.
- Plain Markdown remains the canonical document format.
- Local-first by default: no accounts, sync service, or server dependency in the MVP.
- The current implementation includes the Electron desktop shell, shared renderer UI package, theming foundation, custom title-bar shell, the initial core file/document interfaces, and real workspace/file-loading flows.
- Editor engines and file-backed editing flows are still in progress.

## Workspace Layout

- `apps/desktop`: Electron app, preload bridge, native menu wiring, and desktop-specific shell integration.
- `packages/core`: shared document, filesystem, Markdown-domain code, desktop-safe core adapter contracts, and relative file-reference helpers.
- `packages/editor`: shared editor-facing abstractions and adapters.
- `packages/ui`: shared React app UI for shell layout, title bar, sidebar, status bar, theme behavior, and shared Zustand shell state.
- `docs`: planning and design artifacts.

## Current Desktop Shell

- Frameless desktop window with a custom title bar and drag regions.
- Shared shell UI extracted into `@pluma/ui`.
- Shared typed Zustand store in `@pluma/ui` for theme, workspace, tabs, shell commands, and status metrics.
- Light, dark, and system theme support.
- VS Code-inspired shell structure with title bar, sidebar, editor area, and status bar.
- Real folder loading and Markdown file tree hydration for workspace mode.
- Real file opening into document sessions and shared tabs.
- App menu commands wired for `Open File`, `Open Folder`, `Save`, `Save As`, and `Toggle Rich/Source Mode`.
- Placeholder preview/source rendering on top of real document sessions while CodeMirror and Milkdown are still being implemented.

State architecture is documented in [docs/state-architecture.md](./docs/state-architecture.md). The current desktop `App` now acts as an Electron/preload bridge that hydrates shared shell state for the reusable UI package.

## Development

```bash
pnpm install
pnpm desktop:dev
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

Use `pnpm validate` to run the full local CI sequence.
Use `pnpm desktop:package` to build the packaged desktop app locally.
Use `pnpm desktop:make` to produce desktop artifacts with Electron Forge.

## License

Pluma is licensed under the MIT License. See [LICENSE](./LICENSE).
