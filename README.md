# Pluma

![Pluma logo](./docs/assets/pluma.svg)

Pluma is an open-source, local-first Markdown editor for macOS. It keeps
Markdown files as normal files on disk while providing a polished desktop
writing environment with rich and source editing modes.

## Status

Pluma is alpha-stage software. The macOS desktop app is the first supported
target, and the editing, packaging, and release workflows are still evolving.

Current project commitments:

- Markdown files remain the canonical document format.
- Local-first by default: no accounts, sync service, or server dependency.
- macOS desktop comes first.
- Shared core and UI boundaries stay portable for future Windows, Linux, and
  browser work.
- Small, focused contributions are welcome.

## Workspace Layout

- `apps/desktop`: Electron app, preload bridge, native menu wiring, and macOS-first desktop shell integration.
- `packages/core`: shared document, filesystem, Markdown-domain code, desktop-safe core adapter contracts, and relative file-reference helpers.
- `packages/editor`: shared editor-facing abstractions and adapters.
- `packages/ui`: shared React app UI for shell layout, title bar, sidebar, theme behavior, status metrics, and shared Zustand shell state.
- `docs`: public project documentation for architecture, roadmap, Markdown behavior, design rules, and releases.

## Desktop App

- Frameless desktop window with a custom title bar and drag regions.
- Shared shell UI extracted into `@pluma/ui`.
- Shared typed Zustand store in `@pluma/ui` for theme, workspace, tabs, shell commands, and status metrics.
- Light, dark, and system theme support.
- VS Code-inspired shell structure with title bar, sidebar, and focused editor stage.
- Real folder loading and Markdown file tree hydration for workspace mode.
- Real file opening into document sessions and shared tabs.
- App menu commands wired for `Open File`, `Open Folder`, `Save`, `Save As`, and `Toggle Rich/Source Mode`.
- Draftly rich editing and CodeMirror source editing on top of real file-backed document sessions.

Architecture is documented in [docs/architecture.md](./docs/architecture.md).
The current desktop `App` acts as an Electron/preload bridge that hydrates
shared shell state for the reusable UI package.

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

## Documentation

- [Roadmap](./docs/roadmap.md)
- [Architecture](./docs/architecture.md)
- [Pluma Markdown](./docs/pluma-markdown.md)
- [Design Foundation](./docs/design-foundation.md)
- [macOS Release Notes](./docs/release-macos.md)
- [Release Checklist](./docs/release-checklist.md)

## Contributing

Small, focused contributions are welcome during alpha. Please read
[CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

Use private vulnerability reporting for security issues when available. See
[SECURITY.md](./SECURITY.md).

## License

Pluma is licensed under the MIT License. See [LICENSE](./LICENSE).
