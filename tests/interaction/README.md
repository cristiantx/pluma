# Editor interaction regressions

Run `pnpm exec playwright install chromium` once, then
`pnpm exec playwright test --project=renderer` and
`pnpm exec playwright test --project=electron` sequentially.
The Playwright config starts the real desktop Vite renderer on port 4179.

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
including scrolled cells, explicit line breaks, and drag/Shift-click selection. Numbered
list tests measure marker/text bounds through nine digits, wrapping, nesting, and edits.

Run `pnpm desktop:package` followed by `pnpm test:packaged` to verify the real macOS
application. Override `PLUMA_PACKAGED_EXECUTABLE` for another packaged executable path.
The packaged suite connects through Chromium debugging, uses isolated temporary profiles
and Markdown files, changes native window bounds, and verifies real preload/IPC saves,
undo, Find, theme, math, and diagram interaction. It skips when the package is absent.
