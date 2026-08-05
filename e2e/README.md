# Export pipeline regression tests

Two layers of coverage, targeting the WebCodecs export path:

## 1. Unit regression (runs in CI on every PR)

- `src/lib/exportSettings.test.ts` — codec-string construction, level
  recommendation against the H.264 MaxMBPS/MaxFS spec, bitrate ranges,
  preset composition, warning derivation, file-size estimation, formatters.
- `src/lib/exportTelemetry.test.ts` — error categorization heuristics that
  decide whether a failure gets reported as `codec`, `decode`, `quota`,
  `network`, `abort`, or `unknown`.

Run:

```
bunx vitest run
```

These lock the pure logic that governs which codec/level/bitrate we ask the
encoder for. Any spec-drift or preset regression fails here before hitting
a real encoder.

## 2. Browser-matrix regression (nightly / on-demand)

`e2e/export.regression.spec.ts` drives a real export inside Chromium,
Firefox, and WebKit against a small MP4 fixture, then asserts:

- encode succeeds (`outcome === "success"`),
- the demux+decode path runs faster than realtime (`realtime_multiplier > 1.5x`),
- per-browser floor: `chromium ≥ 3.0x`, `firefox ≥ 2.0x`, `webkit ≥ 1.2x`.

The spec relies on a `window.__runExportBenchmark(opts)` helper that must be
wired up under a test-only flag in `main.tsx`. It should call
`exportVideoFast` with the requested settings and return the telemetry row
that would have been written to `export_metrics`. Do not enable this in
production builds.

Fixture: commit a ~10s H.264 High@4.1 MP4 at `e2e/fixtures/sample-10s.mp4`
and serve it from the dev preview (either via a static route or via
`server.fs.allow`). Keep it under 5 MB so CI pull times stay short.

Run:

```
pnpm dlx playwright install chromium firefox webkit
pnpm dlx playwright test e2e/export.regression.spec.ts
```

## 3. Production telemetry (continuous)

Every export attempt from real users writes a row to `public.export_metrics`
via the `record-export-metric` edge function. The admin dashboard reads
that table to surface encode-time percentiles, effective-fps distributions,
realtime-multiplier trends, and failure-rate breakdowns by
`browser × codec × resolution`. Combined with the unit + Playwright
regressions above, that gives us three overlapping signals:

- Unit tests catch logic regressions instantly on PR.
- Browser matrix catches encoder/decoder regressions across engines nightly.
- Production telemetry catches everything else — device-specific failures,
  slow silicon paths, drivers regressing over time — from the actual user
  distribution.
