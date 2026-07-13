# Performance notes

Performance measurements are diagnostic rather than hardware-sensitive CI gates. Structural tests enforce the optimizations that must remain true across machines.

## Desktop main bundle

Measured from a production Forge package on 2026-07-13.

| Build                        | Raw bytes | Gzip bytes |
| ---------------------------- | --------: | ---------: |
| Before direct settings entry | 2,647,979 |    609,993 |
| After direct settings entry  |   418,638 |    131,210 |
| Final main process bundle    |   424,978 |    133,124 |
| Markdown analysis worker     |   195,172 |     63,468 |

Run `pnpm --filter @pluma/desktop check:main-bundle` after packaging to verify that renderer-only dependencies are absent and print the current sizes.

## Editor cursor mapping

Median of 20 local runs against a 1 MB synthetic Markdown document, mapping a source cursor at the document midpoint.

| Implementation               | Median time |
| ---------------------------- | ----------: |
| Full visible-text projection |     12.8 ms |
| Streaming offset conversion  |      2.3 ms |

## Large-document benchmark

Final measurements from the repeatable benchmark on 2026-07-13. Markdown capability analysis runs in the dedicated worker; its duration does not block Electron's main thread.

| Operation                |  100 KB |   500 KB |     1 MB |
| ------------------------ | ------: | -------: | -------: |
| Worker Markdown analysis | 48.0 ms | 244.3 ms | 559.1 ms |
| Streaming cursor mapping | 0.24 ms |  1.09 ms |  2.18 ms |
| Text search              | 0.03 ms |  0.13 ms |  0.26 ms |

Additional structural results:

- 100 rapid edits produce one latest-text IPC send when flushed.
- 1,000 selection-only search updates perform one document-text read.
- Background session restoration observes the configured concurrency limit of two.
- Workspace tests observe the directory I/O concurrency limit of eight and reject stale scan results.
- Routine document saves emit one document patch and do not serialize unrelated open documents.

Run `pnpm perf` for the complete JSON report. Run a production package first when comparing bundle measurements; an active Forge development watcher may leave unminified development bundles in `.vite/build`.

## Manual trace check

For a release trace, open a 1 MB fixture in the packaged app and record continuous typing plus warm source/rich/preview switches in Electron DevTools. Confirm there are no Pluma-authored synchronous tasks over 50 ms and that warm mode changes complete within 100 ms. Timing remains a diagnostic check rather than a hardware-sensitive CI gate.
