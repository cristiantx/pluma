# Rich editor performance probe

Run `node scripts/performance/richEditorBenchmarks.mjs current` from the repository root.
The probe starts the actual renderer Vite configuration on isolated port 4188,
uses a fresh temporary dependency cache, and launches headless Chromium at 1440 × 1000.
It does not change application source or installed dependencies.

The deterministic documents are exactly 100,000, 500,000, and 1,000,000 ASCII bytes.
Each contains eight Mermaid definitions; additional size comes from prose.
The probe measures a 1.5-second idle interval after 1.8 seconds of settling,
ten selection-only arrow keys with search closed, nine character insertions, and
three full scroll-out/back rounds. Parsing is forced complete before measurement
and after typing. Each return allows three seconds for an SVG; missing returns are
reported separately and do not silently disappear from the results.

Mermaid counts instrument the actual awaited `mermaid.render` call in served code.
Workspace counts instrument a layout effect inside `EditorWorkspace`, independently
of CodeMirror transactions and Mermaid activity. Initial development StrictMode
mounts may count twice; phase deltas avoid treating those as typing commits.

Typing timings include Playwright transport and two animation frames after insertion.
Scroll timings measure two frames after setting scroll position, excluding the
separate SVG wait. Neither is a precise
input-to-paint measure. Hydration timing excludes initial application loading and
asynchronous Mermaid completion. These are focused development-renderer diagnostics,
not packaged production benchmarks, and a single run cannot establish small timing gains.

## Comparison, 19 September 2026

Environment: Apple M4 Pro, Node 24.5.0, Chromium 153.0.8010.12.
The baseline loads the preserved original Draftly package using the optional
`PLUMA_BASELINE_DRAFTLY` absolute package path; its dependencies must resolve from
that location. `PLUMA_BASELINE_SEARCH=1` loads the search controller from Git HEAD
through a Vite plugin. This search override represents the original controller only
while the comparison changes remain uncommitted. Normal runs use installed Draftly
and the current working-tree controller.

| Metric (baseline → patched)            |            100 KB |            500 KB |              1 MB |
| -------------------------------------- | ----------------: | ----------------: | ----------------: |
| Selection workspace commits, 10 keys   |            10 → 0 |            10 → 0 |            10 → 0 |
| Typing workspace commits, 9 characters |             9 → 9 |             9 → 9 |             9 → 9 |
| Scroll Mermaid calls by round          | 2, 2, 2 → 2, 0, 0 | 2, 2, 2 → 2, 0, 0 | 2, 2, 2 → 2, 0, 0 |
| Missing SVG returns, out of 3          |             2 → 0 |             2 → 0 |             2 → 0 |
| Typing p95, ms                         |     34.69 → 46.40 |     34.72 → 48.01 |     47.80 → 47.94 |
| Scrolling p95, ms                      |     31.90 → 31.00 |     33.30 → 30.60 |     33.20 → 31.10 |

All sizes had zero idle DOM mutation records, idle Mermaid calls, and idle workspace
commits in both runs. No long tasks were recorded during idle, selection, typing, or
scrolling. Typing made no Mermaid calls in either run.

The original dependency lost visible SVGs on the second and third return. The patch
restored SVGs on every return and eliminated Mermaid calls on the two warm rounds.
The first round still makes two calls: completing parsing can replace the retained
initial decoration with a new widget on its first viewport remount. This probe does
not claim that cold transition is cached across separate widget instances.

Selection-only workspace commits fell from ten to zero, independently of Mermaid
rendering. Document edits still commit the workspace once per inserted character.
Timing samples are frame-quantized and include overhead; the small sample does not
show a typing-latency improvement and should not be used to claim one.
