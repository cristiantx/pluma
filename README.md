# Pluma

![Pluma logo](./docs/assets/pluma.svg)

Pluma is an open-source, local-first Markdown editor. Markdown files stay as normal files on disk, and the desktop app is being structured so a future browser version can reuse the same core document and filesystem abstractions.

## Current Scope

- Desktop-first MVP built as a monorepo.
- Plain Markdown remains the canonical document format.
- Local-first by default: no accounts, sync service, or server dependency in the MVP.
- The current implementation includes the Electron desktop shell, shared renderer UI package, theming foundation, and custom title-bar shell.
- Document sessions, real file loading, editor engines, and workspace browsing behavior are still in progress.

## Workspace Layout

- `apps/desktop`: Electron app, preload bridge, native menu wiring, and desktop-specific shell integration.
- `packages/core`: shared document, filesystem, and Markdown-domain code.
- `packages/editor`: shared editor-facing abstractions and adapters.
- `packages/ui`: shared React app UI for shell layout, title bar, sidebar, status bar, and theme behavior.
- `docs`: planning and design artifacts.

## Current Desktop Shell

- Frameless desktop window with a custom title bar and drag regions.
- Shared shell UI extracted into `@pluma/ui`.
- Light, dark, and system theme support.
- VS Code-inspired shell structure with title bar, sidebar, editor area, and status bar.
- App menu commands wired for `Open File`, `Open Folder`, `Save`, `Save As`, and `Toggle Rich/Source Mode`.
- Placeholder document preview/source surfaces while editor and file-session phases are still being implemented.

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
