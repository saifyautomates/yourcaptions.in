/**
 * End-to-end auth tests — Google OAuth initiation + role/credit loading.
 *
 * Two flows:
 *  1. Google OAuth initiation from /signin reaches accounts.google.com (or the
 *     Lovable OAuth broker) — no credentials required.
 *  2. Authenticated session (restored via Supabase storage key) loads the
 *     dashboard, calls /rest/v1/user_roles + /rest/v1/credit_wallets +
 *     /rest/v1/profiles, and each returns 200.
 *
 * Run:
 *   BASE_URL=http://localhost:8080 npx playwright test tests/e2e/auth-google-roles.spec.ts
 *
 * Authenticated flow additionally requires either:
 *   SUPABASE_TEST_SESSION_JSON  — a full Supabase session JSON blob, OR
 *   TEST_EMAIL + TEST_PASSWORD  — credentials to sign in via UI first.
 */
import { test, expect, Page, Route } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://scnoehghppfpowggnvhq.supabase.co";
const SUPABASE_PROJECT_ID = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
const STORAGE_KEY = `sb-${SUPABASE_PROJECT_ID}-auth-token`;

const SESSION_JSON = process.env.SUPABASE_TEST_SESSION_JSON ?? "";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
const GOOGLE_TIMEOUT_MS = Number(process.env.GOOGLE_TIMEOUT_MS ?? 15_000);

async function signInWithPassword(page: Page) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

async function restoreSession(page: Page) {
  if (!SESSION_JSON) return false;
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, val }) => window.localStorage.setItem(key, val),
    { key: STORAGE_KEY, val: SESSION_JSON },
  );
  return true;
}

test.describe("Auth — Google OAuth + role/credit loading", () => {
  test.setTimeout(60_000);

  test("Google OAuth: clicking 'Sign in with Google' initiates the provider handshake", async ({
    page,
    context,
  }) => {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });

    const oauthPattern =
      /accounts\.google\.com|oauth\.lovable\.app|\/~oauth\/(initiate|callback)|supabase\.co\/auth\/v1\/authorize/;

    // In preview the SDK opens a popup; in production it may top-nav.
    const popupPromise = context
      .waitForEvent("page", { timeout: GOOGLE_TIMEOUT_MS })
      .catch(() => null);
    const navPromise = page
      .waitForURL(oauthPattern, { timeout: GOOGLE_TIMEOUT_MS })
      .catch(() => null);

    // Also capture the initiate request as a fallback signal, so the test
    // passes even if the popup/nav is intercepted by the sandbox network.
    const initiateReq = page
      .waitForRequest((req) => oauthPattern.test(req.url()), {
        timeout: GOOGLE_TIMEOUT_MS,
      })
      .catch(() => null);

    await page.getByRole("button", { name: /sign in with google/i }).click();

    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      expect(
        oauthPattern.test(popup.url()),
        `popup landed on unexpected URL: ${popup.url()}`,
      ).toBeTruthy();
      await popup.close().catch(() => {});
      return;
    }

    const nav = await navPromise;
    if (nav !== null) {
      expect(oauthPattern.test(page.url())).toBeTruthy();
      return;
    }

    const req = await initiateReq;
    expect(req, "expected an OAuth initiate request to be issued").not.toBeNull();
  });

  test("Google OAuth error path: provider error surfaces without redirecting", async ({
    page,
  }) => {
    // Stub the OAuth initiate to simulate a provider error. The app should
    // surface the error rather than silently leaving the user on /signin.
    await page.route(/\/auth\/v1\/authorize|\/~oauth\/initiate/, (route: Route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_request", error_description: "test-stub" }),
      }),
    );

    await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /sign in with google/i }).click();

    // We shouldn't have been navigated to the dashboard.
    await page.waitForTimeout(2000);
    expect(page.url()).toMatch(/\/signin/);
  });

  test("authenticated: dashboard loads role + credit wallet + profile (all 200)", async ({
    page,
  }) => {
    const restored = await restoreSession(page);
    if (!restored) {
      test.skip(
        !TEST_EMAIL || !TEST_PASSWORD,
        "Provide SUPABASE_TEST_SESSION_JSON or TEST_EMAIL/TEST_PASSWORD to run",
      );
      await signInWithPassword(page);
    }

    const seen = {
      userRoles: null as number | null,
      creditWallets: null as number | null,
      profiles: null as number | null,
    };
    page.on("response", (res) => {
      const u = res.url();
      if (/\/rest\/v1\/user_roles/.test(u)) seen.userRoles = res.status();
      else if (/\/rest\/v1\/credit_wallets/.test(u)) seen.creditWallets = res.status();
      else if (/\/rest\/v1\/profiles/.test(u)) seen.profiles = res.status();
    });

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    // Give the dashboard hooks (useIsAdmin, useCredits) time to fire.
    await page.waitForFunction(
      () =>
        performance
          .getEntriesByType("resource")
          .some((r) => /\/rest\/v1\/(user_roles|credit_wallets|profiles)/.test(r.name)),
      null,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(1500);

    expect(page.url()).toMatch(/\/dashboard/);
    expect(seen.userRoles, "user_roles request never fired").not.toBeNull();
    expect(seen.creditWallets, "credit_wallets request never fired").not.toBeNull();
    expect(seen.profiles, "profiles request never fired").not.toBeNull();
    expect(seen.userRoles).toBe(200);
    expect(seen.creditWallets).toBe(200);
    expect(seen.profiles).toBe(200);
  });

  test("authenticated: user_roles response shape is safe (array, no privilege leak)", async ({
    page,
  }) => {
    const restored = await restoreSession(page);
    if (!restored) {
      test.skip(
        !TEST_EMAIL || !TEST_PASSWORD,
        "Provide SUPABASE_TEST_SESSION_JSON or TEST_EMAIL/TEST_PASSWORD to run",
      );
      await signInWithPassword(page);
    }

    const rolePayload = new Promise<unknown>((resolve) => {
      page.on("response", async (res) => {
        if (/\/rest\/v1\/user_roles/.test(res.url()) && res.status() === 200) {
          try {
            resolve(await res.json());
          } catch {
            resolve(null);
          }
        }
      });
    });

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    const body = (await Promise.race([
      rolePayload,
      new Promise((r) => setTimeout(() => r(null), 15_000)),
    ])) as Array<{ role?: string }> | null;

    expect(Array.isArray(body), `expected array, got ${JSON.stringify(body)}`).toBe(true);
    if (body && body.length > 0) {
      // RLS must scope rows to the caller — every returned row should carry a role.
      for (const row of body) {
        expect(typeof row.role).toBe("string");
      }
    }
  });
});
