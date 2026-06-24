# Contributing

Pluma is an alpha-stage local-first Markdown editor for macOS. Small, focused
contributions are welcome. Larger product or architecture changes should be
discussed in an issue before implementation.

## Good First Contributions

- Documentation fixes.
- Tests for existing behavior.
- Small bug fixes with a clear reproduction.
- Focused UI polish that preserves the current desktop shell structure.
- Maintenance fixes that reduce ambiguity without broad refactors.

Please discuss larger changes first, including new editor engines, sync,
accounts, platform ports, packaging changes, major UI redesigns, or changes to
Markdown parsing and export policy.

## Local Development

Pluma uses pnpm workspaces.

```sh
pnpm install
pnpm desktop:dev
```

Run the full validation sequence before opening a pull request when practical:

```sh
pnpm validate
```

Useful focused commands:

```sh
pnpm lint
pnpm lint:markdown
pnpm typecheck
pnpm test
pnpm build
pnpm desktop:make
```

## Code Style

- Keep Pluma's desktop app structure intact. This is a desktop app, not a
  responsive website shell.
- Use semantic HTML and real controls for interactive UI.
- Keep Electron-only behavior in `apps/desktop/src/main/*`, preload, or desktop
  bridge modules.
- Keep product rules and Markdown behavior in `packages/core`.
- Keep shared renderer state typed and selector-driven in `packages/ui`.
- Use one React component per file, named exports, and `PascalCase.tsx` component
  filenames.
- Use `camelCase.ts` for hooks, view helpers, state modules, and adapters.
- Prefer focused feature folders over broad `helpers`, `utils`, or `lib`
  buckets.

## Pull Requests

Keep pull requests focused. A small fix with tests is easier to review and merge
than a broad cleanup mixed with behavior changes.

Before opening a PR:

- Explain what changed and why.
- Link the related issue when there is one.
- Include tests for behavior changes when practical.
- Include screenshots or short videos for visible UI changes.
- Call out changes that touch Electron IPC, preload boundaries, local file
  access, Markdown rendering/export, or release packaging.

Maintainers may close feature requests or pull requests that are outside the
alpha roadmap or too broad for the current project stage.
