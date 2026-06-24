# Release Checklist

## Before Tagging

1. Confirm the target branch is clean.
2. Update version numbers and release notes.
3. Run:

```sh
pnpm validate
pnpm desktop:make
```

## Package Verification

1. Launch the packaged macOS app.
2. Open an existing Markdown file from inside the packaged app.
3. Double-click a `.md` file in Finder and verify it opens in Pluma.
4. Verify save, autosave, workspace open, and recent close-protection flows still work in the packaged build.

## Release Publication

1. Create and push the release tag.
2. Wait for the `Release` GitHub Actions workflow to finish.
3. Review the generated GitHub Release notes and uploaded `.dmg` and `.zip`
   artifacts.
4. Publish or edit the release notes if needed.
