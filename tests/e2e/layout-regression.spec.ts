/**
 * UI layout regression tests.
 *
 * Guards against layout drift and spacing bugs that shipped repeatedly in the
 * editor (gap between captions column and video, top bar overflow, footer
 * shifts, sidebar width creep). Runs on every deploy.
 *
 * Two layers:
 *   1. Geometric assertions — measure DOM rects and assert exact invariants
 *      (zero gap, non-overlap, min/max width bands). These fail loud on any
 *      spacing regression regardless of visual style.
 *   2. Visual snapshots — Playwright's toHaveScreenshot compares against
 *      committed baselines under e2e/baselines/. Update with:
 *        npx playwright test tests/e2e/layout-regression.spec.ts --update-snapshots
 *
 * Run:
 *   BASE_URL=https://yourcaptions.com \
 *     npx playwright test tests/e2e/layout-regression.spec.ts
 *
 *   # Include authenticated editor checks:
 *   TEST_EMAIL=... TEST_PASSWORD=... TEST_PROJECT_ID=<uuid> \
 *     npx playwright test tests/e2e/layout-regression.spec.ts
 */
import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://yourcaptions.com";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID ?? "";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "laptop-1024", width: 1024, height: 768 },
];

const PUBLIC_PAGES = [
  { name: "home", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "features", path: "/features" },
  { name: "signin", path: "/signin" },
];

// -------- helpers --------

async function stabilize(page: Page) {
  // Disable animations and mask time-sensitive UI so snapshots are stable.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      video, canvas { visibility: hidden !important; }
    `,
  });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(300);
}

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

// -------- 1. Public pages: geometry + snapshots --------

test.describe("Public pages — layout invariants", () => {
  test.setTimeout(45_000);

  for (const vp of VIEWPORTS) {
    for (const p of PUBLIC_PAGES) {
      test(`${p.name} @ ${vp.name} — no horizontal overflow, snapshot stable`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "domcontentloaded" });
        await stabilize(page);

        // No horizontal scrollbars — a common layout regression.
        const overflow = await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return { scrollW: el.scrollWidth, clientW: el.clientWidth };
        });
        expect(overflow.scrollW, `horizontal overflow on ${p.name}`).toBeLessThanOrEqual(
          overflow.clientW + 1,
        );

        // Header must be present, on-screen, and full-width.
        const header = page.locator("header").first();
        if (await header.count()) {
          const box = await header.boundingBox();
          expect(box, "header has bounding box").toBeTruthy();
          expect(box!.x).toBeLessThanOrEqual(1);
          expect(box!.width).toBeGreaterThanOrEqual(vp.width - 2);
        }

        // Visual snapshot (viewport only — full-page varies with lazy assets).
        await expect(page).toHaveScreenshot(`${p.name}-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
          animations: "disabled",
        });
      });
    }
  }
});

// -------- 2. Editor grid: zero gap invariant --------

test.describe("Editor layout — captions/video/panel are gap-free", () => {
  test.setTimeout(90_000);
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !TEST_PROJECT_ID,
    "TEST_EMAIL / TEST_PASSWORD / TEST_PROJECT_ID not set",
  );

  for (const vp of VIEWPORTS) {
    test(`editor grid tracks sum to shell width @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await signIn(page);
      await page.goto(`${BASE_URL}/project/${TEST_PROJECT_ID}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(1500);
      await stabilize(page);

      const measure = () =>
        page.evaluate(() => {
          const shell = document.querySelector<HTMLElement>(
            '[data-testid="editor-shell"], [data-editor-shell]',
          );
          const captions = document.querySelector<HTMLElement>(
            '[data-testid="captions-column"], [data-captions-column]',
          );
          const video = document.querySelector<HTMLElement>(
            '[data-testid="video-column"], [data-video-column]',
          );
          const panel = document.querySelector<HTMLElement>(
            '[data-testid="style-panel"], [data-style-panel]',
          );
          const rect = (el: HTMLElement | null) =>
            el ? el.getBoundingClientRect() : null;
          return {
            shell: rect(shell),
            captions: rect(captions),
            video: rect(video),
            panel: rect(panel),
          };
        });

      const m = await measure();
      // Skip cleanly if the editor uses different selectors — geometry check
      // is meaningless without the three tracks.
      test.skip(
        !m.shell || !m.captions || !m.video,
        "editor shell/captions/video selectors not found — add data-testid hooks",
      );

      // Captions → video: zero gap (allow ≤1px sub-pixel rounding).
      const captionsRightToVideoLeft = m.video!.left - m.captions!.right;
      expect(captionsRightToVideoLeft, "gap between captions and video").toBeLessThanOrEqual(1);
      expect(captionsRightToVideoLeft, "captions must not overlap video").toBeGreaterThanOrEqual(
        -1,
      );

      // Video → panel (when panel is open): zero gap.
      if (m.panel) {
        const videoRightToPanelLeft = m.panel.left - m.video!.right;
        expect(videoRightToPanelLeft, "gap between video and panel").toBeLessThanOrEqual(1);
        expect(videoRightToPanelLeft, "video must not overlap panel").toBeGreaterThanOrEqual(-1);
      }

      // Shell tracks sum to shell width.
      const trackSum =
        m.captions!.width + m.video!.width + (m.panel ? m.panel.width : 0);
      expect(Math.abs(trackSum - m.shell!.width), "tracks sum ≈ shell width").toBeLessThanOrEqual(
        2,
      );
    });
  }

  test("gap stays zero after collapsing and re-opening style panel", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto(`${BASE_URL}/project/${TEST_PROJECT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    await stabilize(page);

    const gap = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLElement>(
          '[data-testid="captions-column"], [data-captions-column]',
        );
        const v = document.querySelector<HTMLElement>(
          '[data-testid="video-column"], [data-video-column]',
        );
        if (!c || !v) return null;
        return v.getBoundingClientRect().left - c.getBoundingClientRect().right;
      });

    const before = await gap();
    test.skip(before === null, "editor selectors not found");
    expect(Math.abs(before!)).toBeLessThanOrEqual(1);

    const toggle = page
      .getByRole("button", { name: /(collapse|expand).*panel|templates/i })
      .first();
    if (await toggle.count()) {
      await toggle.click();
      await page.waitForTimeout(300);
      const collapsed = await gap();
      expect(Math.abs(collapsed!), "gap after collapse").toBeLessThanOrEqual(1);
      await toggle.click();
      await page.waitForTimeout(300);
      const reopened = await gap();
      expect(Math.abs(reopened!), "gap after reopen").toBeLessThanOrEqual(1);
    }
  });
});
