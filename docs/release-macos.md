# macOS Release Notes

Pluma ships macOS artifacts first. Windows and Linux packaging stay outside the
current alpha release path.

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

Expected alpha artifacts:

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

GitHub release builds import an Apple Developer ID certificate only when the
repository has a base64-encoded `.p12` certificate configured:

- `PLUMA_MACOS_CERTIFICATE_P12`
- `PLUMA_MACOS_CERTIFICATE_PASSWORD`

Signed CI releases also need `PLUMA_APPLE_IDENTITY`. Notarization runs when
`PLUMA_APPLE_ID`, `PLUMA_APPLE_ID_PASSWORD`, and `PLUMA_APPLE_TEAM_ID` are also
present. If the certificate secret is absent, the release workflow still builds
unsigned `.dmg` and `.zip` artifacts.

## File Association

The packaged app registers `.md` as an editor-owned macOS document type. Broader Markdown extensions remain future work.

## GitHub Releases Path

Release publication is automated by `.github/workflows/release.yml`:

1. Create and push a release tag that starts with `v`, such as `v0.1.0`.
2. The workflow validates the repo, builds macOS `x64` and `arm64` artifacts,
   and uploads the generated `.dmg` and `.zip` files to the GitHub Release.
3. If the release does not already exist, the workflow creates it with generated
   release notes. If it already exists, the workflow replaces matching assets.

The workflow can also be run manually with an existing tag through
`workflow_dispatch`.
