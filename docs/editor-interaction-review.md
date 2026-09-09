# Editor interaction review

Implemented and verified on September 9, 2026. Pluma uses published fork commit
[`ef273c779d2e`](https://github.com/cristiantx/draftly/commit/ef273c779d2e6dda31b3a2e8bfa95a5a7ad347ee).
The fork preserves its existing history and includes upstream `86ee956ebdfd` plus the
interaction fixes and rebuilt distribution files.

## Findings and implemented behavior

Editing state belongs to each open document. The shared editor session controller retains
CodeMirror state and history across rich/source remounts, preview, tabs, and settings.
Selections retain their full source ranges, anchor/head direction, and main range.
Configuration compartments update surface and theme extensions without replacing history.
A disk reload intentionally establishes a new undo baseline and clamps the source selection.

Find preserves its query and updates counts after editing or editor readiness changes.
Escape returns focus to the editor. Document and settings tabs use semantic controls,
keyboard navigation, and explicit accessibility state. Table toolbar buttons use native
click activation, including Space and Enter.

Draftly plugins are constructed separately for each editor or preview render. The loader
imports the ordinary plugin barrel and the separate Mermaid, math, and emoji entry points.
KaTeX CSS is imported locally so the bundler includes its fonts. Shared semantic tokens map
Draftly colors and fonts onto Pluma's existing theme variables.

Table hit-testing maps rendered coordinates to Markdown source positions and preserves
CodeMirror's native caret and drag behavior. Pluma disables `normalizeOnOpen` and
`normalizeOnChange` to avoid rewriting Markdown as a side effect of opening or ordinary
editing; Draftly's defaults remain enabled.

Mermaid block decorations come directly from a StateField, making multiline replacement
ranges available before CodeMirror computes viewport geometry. View-plugin replacements
still cannot span newlines. Parsed ranges are cached until document or syntax-tree changes;
asynchronous SVG completion requests a layout measurement. Pluma chooses caret activation
instead of selecting the diagram source. SVGs retain intrinsic proportions with a maximum
width constraint. Plugin removal/addition lifecycle hooks also run during reconfiguration.

## Verification

The following checks passed in Chromium 153, alongside a native Electron renderer smoke test:

- Deterministic 66 KB, 100 KB, 500 KB, and 1 MB fixtures open without source rewrites or
  becoming dirty.
- Pointer insertion changes exactly the expected wrapped text and table text. Table cell
  padding insertion and Space/Enter toolbar actions passed after rebuilding the library.
- Clicking “After diagram 48” after deep scrolling changed the scroll position by less
  than 32 px; the earlier failing baseline jumped by approximately 5,000 px. Exact
  source insertion is asserted separately.
- Insertion at the end of a 1 MB source document preserved the expected source text.
- Diagram geometry was exercised in light/dark themes at 960×640 and 1280×820 desktop sizes.
- Forward/backward selections survived modes, tabs, settings, themes, and preview.
  Undo survived these surface changes. Deep viewport offsets also survive source, preview,
  and Settings visits.
- Find Escape restored focus, and query/count behavior survived readiness changes and edits.

Geometry checks use actual pointer events and independently measured DOM text ranges.
They do not place a caret through CodeMirror's selection or position-mapping API.
These observations are regression evidence, not latency measurements. Performance numbers
are diagnostic and must not be treated as hardware-independent CI thresholds.

## Reproduce

Install the browser once, then run suites sequentially from the repository root:

```sh
pnpm exec playwright install chromium
pnpm test:interaction
pnpm test:electron
pnpm validate
pnpm desktop:package
pnpm test:packaged
```

The Playwright configuration starts the desktop Vite renderer at `127.0.0.1:4179`.
Failures retain traces. The Electron renderer suite uses a temporary profile. The separate
packaged-app suite launches the real macOS ARM64 application with another temporary profile
and Markdown file; it verifies the production preload/IPC, exact file save/readback, undo,
Find focus, dark theme, local math fonts, and tables/diagrams in a long document at
960×640 and 1280×820 native window sizes. No user documents or profile are used.

`pnpm validate` passes, and the production package and main-bundle boundary check succeed.
There are 255 unit tests, 27 renderer interaction tests, one Electron renderer smoke test,
and two packaged-app tests. Signing, notarization, other operating systems, and native OS
file-dialog automation were not part of this local verification.
See [the interaction harness notes](../tests/interaction/README.md),
[performance notes](./performance.md), and [release checklist](./release-checklist.md).

Use `pnpm perf` for diagnostic benchmark output. Source-coordinate snapshot medians were
below the report's 0.01 ms precision at every fixture size, versus 0.24/1.06/2.02 ms for
the previous conversion at 100 KB/500 KB/1 MB. These measure snapshot overhead, not complete
click latency; see the performance notes for the comparison method.

## Work allocation

Lower-reasoning agents handle bounded routine tasks with explicit file ownership, such as
focused assertions, import migration, and documentation. The lead retains geometry analysis,
state architecture, and integration decisions, then reconciles the changes and validation
results. Parallel agent work does not substitute for the final integrated checks.
