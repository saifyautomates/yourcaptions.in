/**
 * End-to-end login smoke test — yourcaptions.com
 *
 * Covers:
 *   1. Email/password sign-in against the published URL (happy path + invalid creds).
 *   2. Google OAuth initiation (verifies the redirect/popup reaches accounts.google.com).
 *
 * Run:
 *   BASE_URL=https://yourcaptions.com \
 *   TEST_EMAIL=you@example.com \
 *   TEST_PASSWORD=... \
 *   npx playwright test tests/e2e/login-smoke.spec.ts
 *
 * Optional:
 *   INVALID_EMAIL / INVALID_PASSWORD — used for the negative case (defaults provided).
 *   GOOGLE_TIMEOUT_MS — how long to wait for the provider redirect (default 15000).
 */
import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://yourcaptions.com";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
const INVALID_EMAIL = process.env.INVALID_EMAIL ?? "does-not-exist+smoke@yourcaptions.com";
const INVALID_PASSWORD = process.env.INVALID_PASSWORD ?? "definitely-wrong-password-123!";
const GOOGLE_TIMEOUT_MS = Number(process.env.GOOGLE_TIMEOUT_MS ?? 15000);

async function gotoSignIn(page: Page) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
}

async function captureTokenCall(page: Page) {
  // Capture the /auth/v1/token response so failures surface exact status + body.
  const tokenResponses: Array<{ status: number; url: string; body: string }> = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (/\/auth\/v1\/token/.test(url)) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
      tokenResponses.push({ status: res.status(), url, body: body.slice(0, 500) });
    }
  });
  return tokenResponses;
}

test.describe("Login smoke — published site", () => {
  test.setTimeout(60_000);

  test("email/password: rejects invalid credentials with visible error", async ({ page }) => {
    const tokenCalls = await captureTokenCall(page);
    await gotoSignIn(page);

    await page.getByPlaceholder(/you@example\.com/i).fill(INVALID_EMAIL);
    await page.getByPlaceholder(/your password/i).fill(INVALID_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Inline error card must show
    const errorCard = page.getByRole("alert").filter({ hasText: /couldn't sign you in|sign-in failed/i });
    await expect(errorCard).toBeVisible({ timeout: 10_000 });

    // Should never navigate to dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);

    // /auth/v1/token must have returned a 4xx
    expect(tokenCalls.length, "expected a /auth/v1/token request").toBeGreaterThan(0);
    const last = tokenCalls[tokenCalls.length - 1];
    expect(last.status, `token call body: ${last.body}`).toBeGreaterThanOrEqual(400);
    expect(last.status).toBeLessThan(500);
  });

  test("email/password: valid credentials reach dashboard", async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set — skipping happy path");
    const tokenCalls = await captureTokenCall(page);
    await gotoSignIn(page);

    await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
    await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    expect(page.url()).toContain("/dashboard");

    const ok = tokenCalls.find((r) => r.status === 200);
    expect(ok, `no 200 from /auth/v1/token — got ${JSON.stringify(tokenCalls)}`).toBeTruthy();
  });

  test("google oauth: initiating redirects to accounts.google.com", async ({ page, context }) => {
    await gotoSignIn(page);

    // Managed OAuth may open a popup (preview) or redirect the top window (production).
    const popupPromise = context.waitForEvent("page", { timeout: GOOGLE_TIMEOUT_MS }).catch(() => null);
    const navPromise = page
      .waitForURL(/accounts\.google\.com|\/~oauth\/initiate|oauth\.lovable\.app/, {
        timeout: GOOGLE_TIMEOUT_MS,
      })
      .catch(() => null);

    await page.getByRole("button", { name: /sign in with google/i }).click();

    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded");
      const url = popup.url();
      expect(
        /accounts\.google\.com|oauth\.lovable\.app|\/~oauth\//.test(url),
        `popup landed on unexpected URL: ${url}`,
      ).toBeTruthy();
      await popup.close();
    } else {
      await navPromise;
      const url = page.url();
      expect(
        /accounts\.google\.com|oauth\.lovable\.app|\/~oauth\//.test(url),
        `top-level nav landed on unexpected URL: ${url}`,
      ).toBeTruthy();
    }
  });
});
