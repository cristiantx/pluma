# Editor interaction regressions

Run `pnpm exec playwright install chromium` once, then
`pnpm exec playwright test --project=renderer` and
`pnpm exec playwright test --project=electron` sequentially.
The Playwright config starts the real desktop Vite renderer on port 4179.

These suites are separate from `pnpm validate`. Unit and static tests run under
Vitest; the renderer project covers browser interaction, while the Electron
project is a minimal renderer smoke test and does not exercise production main
process IPC.

Run `pnpm test:production` after building the desktop bundle for the production
Electron layer. It launches `apps/desktop/.vite/build/main.js` with the real
main controller and preload under an isolated profile. Set `PLUMA_MAIN_BUNDLE`
to use another built main entry. The suite exercises native application-menu
routing, sender-scoped IPC, graceful quit, and multiwindow session restoration;
it fails with a build prerequisite when the bundle is absent.

The renderer harness hydrates a document through the exported Zustand store.
The harness replaces persistence/window command handlers with test callbacks; edits and tab changes use the real
renderer store and editor implementations. Assertions read stored Markdown,
while pointer coordinates come independently from DOM text ranges. No test
sets CodeMirror selection or calls its position mapping to place the cursor.

Fixtures are deterministic ASCII Markdown at 66 KB, 100 KB, 500 KB and 1 MB.
Each includes 100 sections and tables, eight Mermaid diagrams, and additional
paragraphs. Diagram count stays bounded so size tests measure document handling
without turning into an unbounded Mermaid benchmark.

Electron smoke launches an isolated BrowserWindow with context isolation and
sandboxing, using a temporary userData directory that is removed on exit.
It exercises the real renderer in Electron; it does not verify production main
process IPC, native menus, packaging, persistence, or OS dialogs.

Failures retain Playwright traces. Tests use observable readiness and polling;
they do not compensate for bugs with fixed sleeps. History across remounts,
search Escape focus, and keyboard tab navigation are deliberate regression
contracts, so failures in these cases require implementation fixes.

Selection regressions compare painted pixels in both themes, including table headers,
body rows, striped rows, ordinary text, and code. They assert that selected text is
visible and readable while unselected text is unchanged. DOM-range bounds independently
check wrapped cells, cross-cell gestures, and multiple selections; Electron also verifies
table highlight bounds and exact replacement through native pointer/keyboard input.

Wrapped-cell whitespace tests click beyond the final character and in bottom padding,
including scrolled cells, explicit line breaks, and drag/Shift-click selection. Caret
regressions compare the real cursor layer against independent glyph rectangles before and
after typing, assert unchanged editor/window scroll offsets, and check multi-caret undo.
They scroll through long documents to tables after diagrams and repeat the wrapped-cell
case after editor state reloads in Electron and in the packaged app. Numbered
list tests measure marker/text bounds through nine digits, wrapping, nesting, and edits.

Run `pnpm desktop:package` followed by `pnpm test:packaged` to verify the real macOS
application. Override `PLUMA_PACKAGED_EXECUTABLE` for another packaged executable path.
The packaged suite connects through Chromium debugging, uses isolated temporary profiles
and Markdown files, changes native window bounds, and verifies real preload/IPC saves,
undo, Find, theme, math, and diagram interaction. It skips when the package is absent.
Treat a skip as missing release evidence: a release check requires a present
executable and a non-skipped packaged run. Finder association, native dialogs,
code signing, and notarization still require manual verification.
