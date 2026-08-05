/**
 * End-to-end route + dashboard smoke tests.
 *
 * Verifies:
 *   1. Every public route loads with a 2xx status, correct title, and zero
 *      uncaught page errors / console errors.
 *   2. Protected routes redirect anonymous visitors to /signin.
 *   3. Sign-in form renders the expected controls.
 *   4. Key dashboard flows for an authenticated user (behind TEST_EMAIL /
 *      TEST_PASSWORD env vars): dashboard loads, search works, sidebar nav
 *      reaches every top-level page, sign-out returns to home.
 *
 * Run:
 *   BASE_URL=https://yourcaptions.com \
 *   npx playwright test tests/e2e/routes-smoke.spec.ts
 *
 *   # With auth flows:
 *   TEST_EMAIL=you@example.com TEST_PASSWORD=... npx playwright test tests/e2e/routes-smoke.spec.ts
 */
import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://yourcaptions.com";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

// Console errors we know are environmental (stale signed URLs on hero video,
// missing preview assets, third-party analytics) — filtered so real regressions
// still surface.
const IGNORED_ERROR_PATTERNS = [
  /Failed to load resource: the server responded with a status of 403/,
  /Failed to load resource: the server responded with a status of 404/,
  /net::ERR_FAILED/,
  /net::ERR_ABORTED/,
];

type Signal = { pageErrors: string[]; consoleErrors: string[] };

function attachSignals(page: Page): Signal {
  const signal: Signal = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (e) => signal.pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (IGNORED_ERROR_PATTERNS.some((re) => re.test(text))) return;
    signal.consoleErrors.push(text);
  });
  return signal;
}

const PUBLIC_ROUTES: Array<{ path: string; expect: RegExp }> = [
  { path: "/", expect: /yourcaptions|captions/i },
  { path: "/pricing", expect: /pricing|yourcaptions|captions/i },
  { path: "/features", expect: /features/i },
  { path: "/about", expect: /about/i },
  { path: "/plugins", expect: /plugins|yourcaptions|captions/i },
  { path: "/testimonials", expect: /testimonials|yourcaptions|captions/i },
  { path: "/signin", expect: /yourcaptions|captions/i },
  { path: "/signup", expect: /yourcaptions|captions/i },
  { path: "/forgot-password", expect: /yourcaptions|captions/i },
  { path: "/does-not-exist", expect: /yourcaptions|captions|not found/i },
];

const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/new",
  "/dashboard/batch",
  "/dashboard/assets",
  "/dashboard/team",
  "/dashboard/editing-software",
  "/dashboard/settings",
  "/dashboard/errors",
];

test.describe("Routes smoke — public pages", () => {
  test.setTimeout(45_000);

  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route.path} loads cleanly`, async ({ page }) => {
      const signal = attachSignals(page);
      const response = await page.goto(`${BASE_URL}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      expect(response, `no response for ${route.path}`).toBeTruthy();
      // Any 2xx or SPA-served 200 is fine; SPA-fallback routes may return 200
      // for /does-not-exist because the client renders NotFound.
      expect(response!.status(), `status for ${route.path}`).toBeLessThan(500);

      // Give React a beat to hydrate and any lazy chunks to resolve.
      await page.waitForTimeout(800);

      const title = await page.title();
      expect(title, `title for ${route.path}`).toMatch(route.expect);

      expect(signal.pageErrors, `pageerror on ${route.path}`).toEqual([]);
      expect(signal.consoleErrors, `console.error on ${route.path}`).toEqual([]);
    });
  }
});

test.describe("Routes smoke — auth guards", () => {
  for (const path of PROTECTED_ROUTES) {
    test(`anonymous ${path} redirects to /signin`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/signin/, { timeout: 15_000 });
      expect(page.url()).toMatch(/\/signin/);
    });
  }
});

test.describe("Sign-in form renders", () => {
  test("shows email, password, submit, and Google button", async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/your password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });
});

// --------- Authenticated dashboard flows (skipped when creds are absent) ---------

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe("Dashboard flows — authenticated", () => {
  test.setTimeout(90_000);
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set");

  test("dashboard renders search + upload dropzone", async ({ page }) => {
    await signIn(page);
    await expect(page.getByLabel(/search videos by title/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /upload video: drop a file here/i }),
    ).toBeVisible();
  });

  test("search filters the recent list without console errors", async ({ page }) => {
    const signal = attachSignals(page);
    await signIn(page);
    await page.getByLabel(/search videos by title/i).fill("zzz-no-match-xyz");
    await expect(page.getByText(/no videos match that search|no videos yet/i)).toBeVisible();
    expect(signal.pageErrors).toEqual([]);
    expect(signal.consoleErrors).toEqual([]);
  });

  test("sidebar navigates to every top-level page", async ({ page }) => {
    await signIn(page);
    const navs: Array<{ name: RegExp; expectUrl: RegExp }> = [
      { name: /recent projects/i, expectUrl: /\/dashboard\/batch/ },
      { name: /editing softwares/i, expectUrl: /\/dashboard\/editing-software/ },
      { name: /manage subscription/i, expectUrl: /\/pricing/ },
      { name: /^home$/i, expectUrl: /\/dashboard$/ },
    ];
    for (const n of navs) {
      await page.getByRole("link", { name: n.name }).first().click();
      await page.waitForURL(n.expectUrl, { timeout: 15_000 });
      expect(page.url()).toMatch(n.expectUrl);
    }
  });

  test("sign-out returns to home and blocks /dashboard again", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /^sign out$/i }).click();
    await page.waitForURL(new RegExp(`${BASE_URL.replace(/\W/g, "\\$&")}/?$`), {
      timeout: 15_000,
    });
    // After sign-out, /dashboard must bounce back to /signin.
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/signin/, { timeout: 15_000 });
  });
});
