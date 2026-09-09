# Editor interaction review

Implemented and verified on September 9, 2026. Pluma uses published fork commit
[`531a36287730`](https://github.com/cristiantx/draftly/commit/531a36287730c1c41b0cd42a5c714b0d0e4fa32a).
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

Blank-space hits inside a wrapped cell choose the nearest visual line vertically before
choosing text horizontally. This keeps a click beside a short final line at that line's
end. The supplied `Cancelled by card?` case previously selected source offset 83 rather
than 91; exact final-line insertion now passes in both themes and native Electron.
Regression cases also cover scrolling, bottom padding, explicit line breaks, and gestures.

Ordered-list marker boxes grow to fit the number, punctuation, and source whitespace.
Their original minimum width remains. One through nine digits, nested/wrapped lists, and
editing across digit counts are covered in browser tests; Electron checks marker width too.

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
There are 255 unit tests, 46 renderer interaction tests, one Electron renderer smoke test,
and two packaged-app tests. Signing, notarization, other operating systems, and native OS
file-dialog automation were not part of this local verification.
See [the interaction harness notes](../tests/interaction/README.md),
[performance notes](./performance.md), and [release checklist](./release-checklist.md).

Follow-up verification exposed an intermittent rapid source-to-rich viewport restoration
failure (two of three isolated repeats passed). That test can return to rich mode before
source readiness and scroll replay complete. This timing issue remains separate from the
list-marker and cell-pointer fixes; its existing regression assertion remains in the suite.

Use `pnpm perf` for diagnostic benchmark output. Source-coordinate snapshot medians were
below the report's 0.01 ms precision at every fixture size, versus 0.24/1.06/2.02 ms for
the previous conversion at 100 KB/500 KB/1 MB. These measure snapshot overhead, not complete
click latency; see the performance notes for the comparison method.

## Selection visibility follow-up

Table backgrounds covered CodeMirror's selection layer, and its line-based geometry
could highlight an entire row for a word selected inside one cell. Rich mode now draws
selection above those surfaces, blending with the existing palette to preserve readable
glyphs. Table fragments use native DOM text rectangles; other content retains CodeMirror's
selection geometry. Cursor behavior, source mode, and document state remain unchanged.
Measurement is limited to rendered rows and skipped entirely for collapsed selections.

Regression coverage includes painted selection pixels in light/dark themes, unselected
text remaining unpainted, wrapped/scrolled cells, keyboard extension, selections across
cells, multiple ranges across mode/theme changes, and native Electron replacement.

## Table caret and scrolling follow-up

The earlier wrapped-cell fix checked insertion offsets but missed a zero-height caret at
the table edge. At a correct cell-end offset, an unassociated CodeMirror selection could
measure hidden padding instead of the preceding glyph. In the reproduction, typing two
characters moved the editor from scrollTop 467 to 287. The corrected caret has the text's
22 px height and keeps scrollTop at 467 before and after typing.

Draftly now preserves the clicked visual side, including soft wraps, and repairs every
collapsed selection at cell boundaries after typing, keyboard commands, and parsing.
Repairs preserve the main range and undo grouping. Editor state reloads reactivate the
plugin's deferred work instead of leaving the reused view marked as destroyed.

Long-document testing also found that the decoration iterator pruned the shared Document
ancestor after its first visible range, leaving tables after diagrams as raw Markdown.
It now visits later ranges while keeping callbacks unique and balanced and skipping gaps.

Tests independently compare glyph rectangles with the actual cursor layer, including
focus and visibility, before and after typing. They check editor/window scroll offsets,
wrapped and empty cells, alignment, padding, explicit breaks, gestures, keyboard editing,
multi-caret typing, grouped undo, and 100 KB/500 KB/1 MB documents beside Mermaid diagrams.
The long-document fixture is reached through real wheel scrolling. An artificial direct
jump during test setup could produce an initial measurement-loop warning; real scrolling
and the subsequent caret interactions complete without warnings. Both native packaged
window sizes additionally verify exact file saves and undo with a scrolled wrapped cell.

## Work allocation

Lower-reasoning agents handle bounded routine tasks with explicit file ownership, such as
focused assertions, import migration, and documentation. The lead retains geometry analysis,
state architecture, and integration decisions, then reconciles the changes and validation
results. Parallel agent work does not substitute for the final integrated checks.
