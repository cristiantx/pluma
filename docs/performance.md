# Performance notes

Performance measurements are diagnostic rather than hardware-sensitive CI gates. Structural tests enforce the optimizations that must remain true across machines.

## Desktop main bundle

Measured from a production Forge package on 2026-07-13.

| Build                        | Raw bytes | Gzip bytes |
| ---------------------------- | --------: | ---------: |
| Before direct settings entry | 2,647,979 |    609,993 |
| After direct settings entry  |   418,638 |    131,210 |

Run `pnpm --filter @pluma/desktop check:main-bundle` after packaging to verify that renderer-only dependencies are absent and print the current sizes.
