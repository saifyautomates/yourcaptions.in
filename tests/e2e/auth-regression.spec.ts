/**
 * Auth regression e2e — protects against:
 *   • Infinite render loops (React "Maximum update depth exceeded")
 *   • Protected-route bypasses (/dashboard reachable while signed out)
 *   • Broken logout (session persists after signOut)
 *   • Auth pages crashing on load
 *
 * Run:
 *   BASE_URL=http://localhost:8080 npx playwright test tests/e2e/auth-regression.spec.ts
 *   # Happy-path logout requires:
 *   TEST_EMAIL=... TEST_PASSWORD=... npx playwright test tests/e2e/auth-regression.spec.ts
 */
import { test, expect, Page, ConsoleMessage } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

/** Fails the test if any React "Maximum update depth" / infinite-loop error fires. */
function attachLoopGuard(page: Page): { violations: string[] } {
  const violations: string[] = [];
  const handler = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (
      /Maximum update depth exceeded/i.test(text) ||
      /Too many re-?renders/i.test(text) ||
      /Rendered more hooks than during the previous render/i.test(text)
    ) {
      violations.push(text);
    }
  };
  page.on("console", handler);
  page.on("pageerror", (err) => {
    if (/Maximum update depth|Too many re-?renders/i.test(err.message)) {
      violations.push(err.message);
    }
  });
  return { violations };
}

async function clearAuthStorage(page: Page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-") || k.includes("supabase")) localStorage.removeItem(k);
      }
      sessionStorage.clear();
    } catch {
      /* storage unavailable in some contexts */
    }
  });
}

test.describe("Auth regression", () => {
  test.setTimeout(60_000);

  test("public routes render without infinite loops", async ({ page }) => {
    const guard = attachLoopGuard(page);
    for (const path of ["/", "/signin", "/signup", "/forgot-password", "/pricing"]) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
      // Give React a beat to potentially re-render itself into oblivion.
      await page.waitForTimeout(1500);
      expect(guard.violations, `loop on ${path}:\n${guard.violations.join("\n")}`).toEqual([]);
    }
  });

  test("/dashboard while signed out redirects to /signin", async ({ page }) => {
    await clearAuthStorage(page);
    const guard = attachLoopGuard(page);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/signin/, { timeout: 15_000 });
    expect(page.url()).toContain("/signin");
    expect(guard.violations).toEqual([]);
  });

  test("other protected routes redirect to /signin when signed out", async ({ page }) => {
    await clearAuthStorage(page);
    for (const path of ["/dashboard/errors", "/dashboard/usage", "/new-project"]) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
      // Either we redirect to /signin, or the route is public — both fine as long
      // as we never render the dashboard shell without a session.
      await page.waitForTimeout(2000);
      const url = page.url();
      if (!/\/signin/.test(url)) {
        // If we didn't redirect, ensure no authenticated-only content leaked.
        const leaked = await page
          .getByText(/sign out|dashboard/i)
          .first()
          .isVisible()
          .catch(() => false);
        expect(leaked, `Protected content leaked on ${path} (url=${url})`).toBeFalsy();
      }
    }
  });

  test("sign-in error surfaces recovery UI without navigating", async ({ page }) => {
    const guard = attachLoopGuard(page);
    await clearAuthStorage(page);
    await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });

    await page.getByPlaceholder(/you@example\.com/i).fill("regression+notreal@yourcaptions.com");
    await page.getByPlaceholder(/your password/i).fill("definitely-wrong-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(/couldn't sign you in|incorrect|invalid|failed/i);

    // Recovery panel exposes a retry action and the request ID.
    await expect(alert.getByRole("button", { name: /try again|retry/i }).first()).toBeVisible();
    await expect(alert).toContainText(/req:\s*rid_/i);

    expect(page.url()).toMatch(/\/signin/);
    expect(guard.violations).toEqual([]);
  });

  test("full sign-in → protected page → sign-out flow", async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set");
    const guard = attachLoopGuard(page);
    await clearAuthStorage(page);

    // Sign in
    await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
    await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Session persists across reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/\/dashboard/);

    // Sign out via supabase client, then verify /dashboard bounces to /signin
    await page.evaluate(async () => {
       
      const w = window as any;
      if (w.supabase?.auth?.signOut) await w.supabase.auth.signOut();
      else {
        // Fallback: nuke the Supabase session key so the next nav sees no session.
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("sb-") || k.includes("supabase")) localStorage.removeItem(k);
        }
      }
    });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/signin/, { timeout: 15_000 });
    expect(page.url()).toContain("/signin");

    expect(guard.violations, guard.violations.join("\n")).toEqual([]);
  });
});
