// Browser-matrix regression test for the export pipeline.
//
// Not run in unit-test CI (Playwright, real WebCodecs, real MP4 fixture). Run
// locally or in a browser-matrix CI job:
//
//   pnpm dlx playwright install chromium firefox webkit
//   pnpm dlx playwright test e2e/export.regression.spec.ts \
//     --project=chromium --project=firefox --project=webkit
//
// The spec drives a real export in-browser, measures encode time via the
// same telemetry the app writes to Supabase, and asserts:
//   - encode completes without error
//   - realtime multiplier > 1.5x on the demux path (i.e. faster than realtime)
//   - failure rate across the matrix is 0
//
// The fixture MP4 must be small (<= 10s) and encoded with an H.264 profile
// widely supported by both encoders and decoders (High @ 4.1). Put it at
// e2e/fixtures/sample-10s.mp4 and commit it.

import { test, expect, Page } from "@playwright/test";

const FIXTURE = "/e2e-fixtures/sample-10s.mp4";
const TARGETS: Array<{ resolution: "720p" | "1080p"; profile: "main" | "high"; level: "4.1" }> = [
  { resolution: "720p",  profile: "main", level: "4.1" },
  { resolution: "1080p", profile: "high", level: "4.1" },
];

async function runExport(page: Page, target: (typeof TARGETS)[number]) {
  // Assume the dev preview exposes a `__runExportBenchmark` global that
  // drives exportVideoFast with the given settings and resolves with a
  // telemetry payload. Wire this up in main.tsx when NODE_ENV === "test".
  return page.evaluate(async (t) => {
    const w = window as unknown as { __runExportBenchmark: (opts: unknown) => Promise<unknown> };
    if (!w.__runExportBenchmark) throw new Error("__runExportBenchmark not exposed");
    return await w.__runExportBenchmark(t);
  }, target);
}

for (const target of TARGETS) {
  test(`export regression — ${target.resolution} ${target.profile}@${target.level}`, async ({ page, browserName }) => {
    await page.goto("/dashboard");
    // The fixture MP4 must be served under `/e2e-fixtures/` — configure
    // vite.config.ts's `server.fs.allow` or a static route in the preview.
    await page.waitForSelector('[data-testid="export-benchmark-ready"]');

    const result = (await runExport(page, target)) as {
      encode_time_ms: number;
      realtime_multiplier: number;
      effective_fps: number;
      outcome: string;
      path: string;
      codec: string;
    };

    console.log(`[${browserName}] ${target.resolution} ${result.codec}: ${result.encode_time_ms}ms, ${result.realtime_multiplier}x realtime, ${result.effective_fps} fps`);

    expect(result.outcome, "export should succeed").toBe("success");
    if (result.path === "demux-decode") {
      // WebCodecs path should always beat realtime by a solid margin.
      expect(result.realtime_multiplier).toBeGreaterThan(1.5);
    }
    // Track baselines per browser — update these floors when they legitimately shift.
    const floors: Record<string, number> = {
      chromium: 3.0,
      firefox: 2.0,
      webkit: 1.2,
    };
    if (result.path === "demux-decode") {
      expect(result.realtime_multiplier).toBeGreaterThan(floors[browserName] ?? 1.5);
    }
  });
}
