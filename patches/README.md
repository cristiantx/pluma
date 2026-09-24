# Draftly editor fixes

`draftly@2.0.0.patch` applies to the pinned Draftly commit in
`packages/editor/package.json`. pnpm installs it through `patchedDependencies`
in `pnpm-workspace.yaml`; the lockfile records its content hash.

The patch covers the corresponding TypeScript sources and both shipped ESM and
CommonJS chunks. The Mermaid chunks omit their original source-map references
because those maps describe the unpatched code.

Mount lifetime is held in a weak map keyed by the DOM element. This also handles
CodeMirror transferring an element to an equal replacement widget before calling
`destroy`. Successful SVG output is retained on the widget for synchronous remounts;
errors remain retryable, and destroyed mounts cannot update a view. There is no
global completed-SVG cache.

Table cells retain a transient editable boundary when a user types a space at the
end of visible content. Selection repair and atomic ranges honor that boundary so
continued text is inserted after the space rather than before it. The boundary is
cleared by later document or selection changes; regular Markdown table padding
keeps its existing behavior.

When updating Draftly, port or remove the patch and regenerate its lockfile hash.
Verify both runtime formats, run `mermaidWidgetLifecycle.test.ts`, and run the
renderer diagram lifecycle, sizing, table whitespace, and table caret suites. After
warming the final parsed widget, the scroll regression checks that its SVG render ID
remains unchanged through five viewport removals. Equal replacement widget
descriptions may render once on their first mount; completed output is not shared
globally between descriptions.
