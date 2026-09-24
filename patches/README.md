# Draftly Mermaid lifecycle patch

`draftly@2.0.0.patch` applies to the pinned Draftly commit in
`packages/editor/package.json`. pnpm installs it through `patchedDependencies`
in `pnpm-workspace.yaml`; the lockfile records its content hash.

The patch covers the TypeScript widget and both shipped ESM and CommonJS chunks.
The changed chunks omit their original source-map references because those maps
describe the unpatched code. Other chunks and maps remain unchanged.

Mount lifetime is held in a weak map keyed by the DOM element. This also handles
CodeMirror transferring an element to an equal replacement widget before calling
`destroy`. Successful SVG output is retained on the widget for synchronous remounts;
errors remain retryable, and destroyed mounts cannot update a view. There is no
global completed-SVG cache.

When updating Draftly, port or remove the patch and regenerate its lockfile hash.
Verify both runtime formats, run `mermaidWidgetLifecycle.test.ts`, and run the
renderer diagram lifecycle and sizing suites. After warming the final parsed widget,
the scroll regression checks that its SVG render ID remains unchanged through five
viewport removals. Equal replacement widget descriptions may render once on their
first mount; completed output is not shared globally between descriptions.
