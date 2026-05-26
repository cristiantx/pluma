# Pluma

![Pluma logo](./docs/assets/pluma.svg)

Pluma is an open-source, local-first Markdown editor. Markdown files stay as normal files on disk, and the desktop app is being structured so a future browser version can reuse the same core document and filesystem abstractions.

## Current Scope

- Desktop-first MVP built as a monorepo.
- Plain Markdown remains the canonical document format.
- Local-first by default: no accounts, sync service, or server dependency in the MVP.
- Phase 0 establishes repository structure and shared tooling. The Electron shell lands in Phase 1.

## Workspace Layout

- `apps/desktop`: desktop application shell placeholder for the upcoming Electron app.
- `packages/core`: shared document, filesystem, and Markdown-domain code.
- `packages/editor`: shared editor-facing abstractions and adapters.
- `docs`: planning and design artifacts.

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

Use `pnpm validate` to run the full local CI sequence.

## License

Pluma is licensed under the MIT License. See [LICENSE](./LICENSE).
