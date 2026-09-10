# Release Checklist

## Before Tagging

1. Confirm the target branch is clean.
2. Update version numbers and release notes.
3. Run:

```sh
pnpm validate
pnpm desktop:make
```

`pnpm validate` covers linting, formatting, type checking, unit/static tests,
and builds. It does not run Playwright. Run the renderer interaction suite and
the minimal Electron renderer smoke separately:

```sh
pnpm test:interaction
pnpm test:electron
pnpm test:production
```

The production project launches the built desktop main bundle with the real
controller and preload. Build or package first; a missing bundle is a failure,
not a skipped test.

## Package Verification

1. Launch the packaged macOS app.
2. Open an existing Markdown file from inside the packaged app.
3. Double-click a `.md` file in Finder and verify it opens in Pluma.
4. Verify save, autosave, workspace open, and recent close-protection flows still work in the packaged build.
5. Run `pnpm test:packaged` after packaging and confirm it does not skip. The
   default executable is the macOS ARM64 package; set
   `PLUMA_PACKAGED_EXECUTABLE` to test another packaged executable.
6. Manually verify native file dialogs and Finder open behavior; the automated
   packaged suite does not drive those OS surfaces.
7. For a signed release, verify the signature and successful notarization
   separately from artifact creation.

## Release Publication

1. Create and push the release tag.
2. Wait for the `Release` GitHub Actions workflow to finish.
3. Review the generated GitHub Release notes and uploaded `.dmg` and `.zip`
   artifacts.
4. Publish or edit the release notes if needed.
