# macOS Release Notes

Pluma ships macOS artifacts first. Windows and Linux packaging stay out of the MVP release path.

## Local Artifact Build

Run the macOS packaging flow from the repo root:

```sh
pnpm desktop:make
```

If `maker-dmg` was installed before `macos-alias` was added to the `pnpm.onlyBuiltDependencies` allowlist, rebuild the pending native modules once:

```sh
pnpm rebuild --pending macos-alias fs-xattr
```

If the Forge icon configuration points at a macOS `.icon` asset bundle, packaging also requires full Xcode because Electron Packager calls `actool`. Command Line Tools alone are not enough.

Electron Forge writes release artifacts under `apps/desktop/out/make`.

Expected MVP artifacts:

- `dmg`
- `zip`

## Signing And Notarization Placeholders

`apps/desktop/forge.config.ts` enables signing only when these environment variables are present:

- `PLUMA_APPLE_IDENTITY`
- `PLUMA_APPLE_ID`
- `PLUMA_APPLE_ID_PASSWORD`
- `PLUMA_APPLE_TEAM_ID`

Placeholder entitlement files live in:

- `apps/desktop/assets/entitlements.mac.plist`
- `apps/desktop/assets/entitlements.mac.inherit.plist`

Unsigned local builds remain valid for development packaging checks.

## File Association

The packaged app registers `.md` as an editor-owned macOS document type. Broader Markdown extensions remain future work.

## GitHub Releases Path

Release publication is manual for now:

1. Build artifacts with `pnpm desktop:make`.
2. Create a Git tag for the release version.
3. Draft a GitHub Release from that tag.
4. Upload the generated `.dmg` and `.zip` artifacts from `apps/desktop/out/make`.

This keeps the release shape compatible with a later automated GitHub Releases pipeline and future auto-update work.
