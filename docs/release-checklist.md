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
2. Draft the GitHub Release for that tag.
3. Upload the generated `.dmg` and `.zip` artifacts from `apps/desktop/out/make`.
4. Publish the release notes.
