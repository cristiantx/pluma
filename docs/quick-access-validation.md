# Quick Access validation

Measured on 10 September 2026. Core measurements used the working tree based on
`e414408`; browser measurements cover the final validation changes following
implementation commit `6c31080`. Quick Open reuses accepted workspace entries and window-local open
metadata. Pure matching lives in `@pluma/core/quick-access`; the renderer module
worker normalizes candidates in batches of 100 and searches in batches of 250,
yielding between batches through `scheduler.yield()` when available, with a
`setTimeout(0)` fallback. Request/revision checks discard obsolete responses.
The shared overlay uses registry-derived commands and guarded desktop activation.
Document text is excluded from the search index.

## Using Quick Access

Open files with `Cmd+P` on macOS or `Ctrl+P` on Windows/Linux. Open commands with
`Cmd+Shift+P` or `Ctrl+Shift+P`. Repeating a shortcut refocuses the query; switching
modes retains each query for the current opening. Type `>` in file mode to enter
command mode. Arrow keys select, Enter opens or runs once, and Escape closes.
Highlighting a file does not activate it. Empty file queries show open/recent
items; unavailable commands remain discoverable with a reason.

## Reproduce the core benchmark

Build the current core package, then run:

```sh
pnpm --filter @pluma/core build
node --expose-gc scripts/performance/quickAccessBenchmarks.mjs
```

The recorded run used the existing compiled core output; the benchmark itself
creates no build artifacts. Host: Apple M4 Pro, 12 logical CPUs, 24 GiB RAM,
macOS 26.6.2 / Darwin 25.6.0, arm64, Node.js v24.5.0.

The deterministic corpus contains repeated basenames in distinct long paths,
combining accents, emoji, open-document metadata, and recency metadata. All
candidate paths are unique. Three index builds run per size with explicit GC
before each. “First” means the first build for that size in this process, not a
fresh-process or filesystem-cache measurement; “warm” averages the next two.

Each prepared index serves five rounds of six queries: empty, `note`, `café`,
`note 12`, `project-12/notes`, and `zzzz-no-match`. Query timings include query
normalization, candidate matching, sorting, and collecting at most 50 results.
The reported query percentiles cover all 30 samples per size, without dropping
initial samples.

| Candidates | First index ms | Warm index ms | Query p50 ms | Query p95 ms | Query max ms |
| ---------- | -------------: | ------------: | -----------: | -----------: | -----------: |
| 1,000      |          28.70 |         23.24 |         0.81 |         5.02 |         6.16 |
| 10,000     |         244.50 |        229.70 |         7.70 |        21.80 |        27.17 |
| 50,000     |       1,238.61 |      1,190.97 |        45.61 |       114.44 |       122.49 |

At 50,000 candidates, the broad `note` query had a 114.15 ms median; the no-match
query had a 31.08 ms median. These measurements establish a local baseline,
not a release latency target or a regression comparison.

## Browser worker baseline

Run `node scripts/performance/quickAccessBrowserBenchmarks.mjs`. The script uses
an isolated Vite server on port 4188, a temporary dependency cache, and headless
Playwright Chromium. It imports the actual desktop search adapter and its module
worker without mounting the application. It closes the browser/server and removes
the temporary cache on completion.

The 10 September run used Chromium 153.0.8010.12 on the same host. Each size uses
a fresh worker, the same filename/path corpus, and three rounds of the six query
strings above (18 warm samples). Browser candidates omit open/recency boosts.
“Cold” includes worker startup, index transfer/build, and first query after the
adapter module has loaded; it does not include browser startup or a fully cold
network cache. Results below are the original `setTimeout(0)` yield baseline.

| Files  | Cold first result ms | Warm p50 ms | Warm p95 ms | Refresh result ms | Replacement result ms |
| ------ | -------------------: | ----------: | ----------: | ----------------: | --------------------: |
| 1,000  |                103.6 |         0.7 |         3.2 |              59.6 |                   1.5 |
| 10,000 |                893.2 |       182.6 |       207.4 |             908.2 |                 200.6 |
| 50,000 |              4,676.3 |     1,056.6 |     1,165.2 |           4,587.0 |               1,082.3 |

Refresh sends a new candidate-array identity containing the same metadata.
Replacement immediately supersedes a broad query with `café`; the obsolete
promise rejected with `AbortError` in 0.6, 0.1, and 0.0 ms respectively. That is
promise cancellation latency, not a measurement of the worker stopping its work.
No renderer long tasks were observed. A 10 ms renderer timer measured delay p95
of 1.0, 1.1, and 1.1 ms and maximum delays of 2.3, 1.3, and 13.7 ms respectively.
The timer probe indicates event-loop availability, not actual keyboard latency.

These are adapter-to-worker roundtrips, not keystroke-to-visible-result or UI
paint measurements. At 50,000 files the timer-yield worker is substantially slower
than synchronous core matching, despite keeping the renderer responsive. The
results support investigating cooperative-yield overhead before release.

## Scheduler comparison

The same harness was rerun after switching worker yields to `scheduler.yield()`
with a timer fallback. The API schedules a continuation after yielding; it is
available in workers ([MDN reference](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)).
The harness checked the actual worker globals and confirmed
scheduler support in all three Chromium workers. Corpus, query rounds, and host
were unchanged; this is a sequential comparison rather than a controlled
multi-run statistical study.

| Files  | Cold first result ms | Warm p50 ms | Warm p95 ms | Refresh result ms | Replacement result ms |
| ------ | -------------------: | ----------: | ----------: | ----------------: | --------------------: |
| 1,000  |                 86.3 |         1.1 |         4.1 |              26.3 |                   3.1 |
| 10,000 |                252.8 |         9.0 |        30.7 |             196.3 |                  23.6 |
| 50,000 |              1,009.2 |        52.0 |       168.6 |           1,194.0 |                 119.1 |

At 50,000 files, warm median worker roundtrip fell from 1,056.6 to 52.0 ms;
first result fell from 4,676.3 to 1,009.2 ms. No renderer long tasks were observed.
Timer delay p95 remained 1.1 ms at every size; maximum delay was 1.1, 1.1, and
18.6 ms. Superseded promises rejected with `AbortError` in 1.0, 0.0, and 0.0 ms.
These measurements confirm a substantial reduction in this Chromium worker's
scheduling overhead. Environments using the timer fallback may retain the slower
baseline; their behavior has not been measured here.

## Evidence and remaining checks

Focused automated coverage includes core ranking/highlights/tokens/MRU, scan
failure versus empty results, coordinator disposal, worker query/revision races,
request supersession, opening state, candidate identity, command contexts,
post-read workspace invalidation, and exact command ranking. Each contribution's
focused tests and lint passed. Integrated validation passed:

- `pnpm validate`: 373 tests, plus its lint/typecheck/build checks.
- Renderer: 53 tests and a focused 7-test pass.
- Production: 3 tests and a focused exact-text persistence test.
- Packaged: 3 tests, including native Cmd+P/Cmd+Shift+P from Source, Rich,
  Preview, and Settings.
- Electron: 1 test.

After the scheduler change, `pnpm validate` passed again (373 tests), and the
rebuilt packaged suite passed all 3 tests, including the strengthened exact
disk-text assertion.

The core microbenchmark excludes worker and renderer costs; the separate browser
harness measures combined worker roundtrips and event-loop delay. Neither measures
filesystem scans, worker memory, actual keyboard handling, or
keystroke-to-visible-result latency. Worker startup, serialization, and scheduling
costs are not individually isolated. Electron interaction and packaged-bundle
validation must establish user-facing behavior separately.

A manual VoiceOver pass and Windows/Linux native accelerator behavior have not
been verified. The macOS packaged checks above provide automated native
accelerator evidence; skipped tests are not counted as passes.
