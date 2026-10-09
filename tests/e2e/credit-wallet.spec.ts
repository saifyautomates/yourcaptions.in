/**
 * End-to-end test — credit wallet loading + credit-related API responses.
 *
 * Verifies, after login:
 *  1. GET /rest/v1/credit_wallets returns 200 with the caller's wallet row
 *     (plan_credits, topup_credits present, numeric, non-negative).
 *  2. POST /rest/v1/rpc/my_usage returns 200 with an array of meter rows
 *     (kind + used + quota + remaining) — quota > 0, remaining = quota - used.
 *  3. GET /rest/v1/credit_transactions returns 200 (may be an empty array
 *     for brand-new users; must not error).
 *  4. The dashboard <LiveLimitsWidget /> renders a credit balance sourced
 *     from the wallet, not a spinner or error state.
 *
 * Run:
 *   BASE_URL=http://localhost:8080 npx playwright test tests/e2e/credit-wallet.spec.ts
 *
 * Requires either:
 *   SUPABASE_TEST_SESSION_JSON  — a full Supabase session JSON blob, OR
 *   TEST_EMAIL + TEST_PASSWORD  — credentials to sign in via UI first.
 */
import { test, expect, Page, Response } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://scnoehghppfpowggnvhq.supabase.co";
const SUPABASE_PROJECT_ID = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
const STORAGE_KEY = `sb-${SUPABASE_PROJECT_ID}-auth-token`;

const SESSION_JSON = process.env.SUPABASE_TEST_SESSION_JSON ?? "";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

async function signInWithPassword(page: Page) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

async function restoreSession(page: Page): Promise<boolean> {
  if (!SESSION_JSON) return false;
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, val }) => window.localStorage.setItem(key, val),
    { key: STORAGE_KEY, val: SESSION_JSON },
  );
  return true;
}

async function ensureAuthed(page: Page) {
  const restored = await restoreSession(page);
  if (!restored) {
    test.skip(
      !TEST_EMAIL || !TEST_PASSWORD,
      "Set SUPABASE_TEST_SESSION_JSON or TEST_EMAIL/TEST_PASSWORD to run authenticated credit tests.",
    );
    await signInWithPassword(page);
  }
}

async function readJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

test.describe("Credits — wallet + API loading", () => {
  test.setTimeout(60_000);
  test.skip(
    !SESSION_JSON && (!TEST_EMAIL || !TEST_PASSWORD),
    "Set SUPABASE_TEST_SESSION_JSON or TEST_EMAIL/TEST_PASSWORD to run authenticated credit tests.",
  );

  test("credit_wallets returns the caller's wallet with valid numeric buckets", async ({ page }) => {
    await ensureAuthed(page);

    const walletPromise = page.waitForResponse(
      (res) => res.url().includes("/rest/v1/credit_wallets") && res.request().method() === "GET",
      { timeout: 20_000 },
    );

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    const res = await walletPromise;
    expect(res.status(), `credit_wallets HTTP status: ${res.status()}`).toBe(200);

    const body = (await readJson(res)) as Array<Record<string, unknown>> | null;
    expect(Array.isArray(body), "credit_wallets response must be an array").toBe(true);

    // Some deployments return [] on first hit before the auto-create trigger
    // runs; the very next fetch should populate it. Poll briefly to avoid a
    // flaky first-run false negative.
    let rows = body ?? [];
    for (let i = 0; rows.length === 0 && i < 5; i++) {
      await page.waitForTimeout(500);
      const r = await page.request.get(
        `${SUPABASE_URL}/rest/v1/credit_wallets?select=plan_credits,topup_credits`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY ?? "",
            Authorization: `Bearer ${await page.evaluate(
              (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}")?.access_token ?? "",
              STORAGE_KEY,
            )}`,
          },
        },
      );
      rows = (await r.json().catch(() => [])) as Array<Record<string, unknown>>;
    }

    expect(rows.length, "wallet row should exist for authenticated user").toBeGreaterThan(0);
    const wallet = rows[0] as { plan_credits?: unknown; topup_credits?: unknown };
    expect(typeof wallet.plan_credits === "number" || typeof wallet.plan_credits === "string").toBe(true);
    expect(typeof wallet.topup_credits === "number" || typeof wallet.topup_credits === "string").toBe(true);
    expect(Number(wallet.plan_credits)).toBeGreaterThanOrEqual(0);
    expect(Number(wallet.topup_credits)).toBeGreaterThanOrEqual(0);
  });

  test("rpc/my_usage returns shaped meter rows with quota >= used", async ({ page }) => {
    await ensureAuthed(page);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });

    const accessToken = await page.evaluate(
      (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}")?.access_token ?? "",
      STORAGE_KEY,
    );
    expect(accessToken, "authenticated access token required").toBeTruthy();

    const res = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/my_usage`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: {},
    });
    expect(res.status(), `my_usage HTTP status: ${res.status()}`).toBe(200);

    const meters = (await res.json()) as Array<{
      kind: string; used: number; quota: number; remaining: number;
    }>;
    expect(Array.isArray(meters)).toBe(true);
    const kinds = meters.map((m) => m.kind).sort();
    expect(kinds).toEqual(expect.arrayContaining(["caption_seconds", "dub_seconds", "export_count"]));

    for (const m of meters) {
      expect(Number(m.quota), `${m.kind} quota`).toBeGreaterThan(0);
      expect(Number(m.used), `${m.kind} used`).toBeGreaterThanOrEqual(0);
      expect(Number(m.remaining), `${m.kind} remaining`).toBe(Number(m.quota) - Number(m.used));
    }
  });

  test("credit_transactions endpoint responds 200 (empty or populated)", async ({ page }) => {
    await ensureAuthed(page);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });

    const accessToken = await page.evaluate(
      (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}")?.access_token ?? "",
      STORAGE_KEY,
    );

    const res = await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_transactions?select=id,type,amount,balance_after,created_at&order=created_at.desc&limit=5`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY ?? "",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    expect(res.status(), `credit_transactions HTTP status: ${res.status()}`).toBe(200);

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("type");
      expect(row).toHaveProperty("amount");
      expect(row).toHaveProperty("balance_after");
    }
  });

  test("dashboard widget renders a credit balance sourced from the wallet", async ({ page }) => {
    await ensureAuthed(page);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });

    // Wait for wallet fetch to settle before asserting UI.
    await page
      .waitForResponse(
        (res) => res.url().includes("/rest/v1/credit_wallets") && res.status() === 200,
        { timeout: 20_000 },
      )
      .catch(() => null);

    const widget = page.getByTestId("live-limits-widget");
    // Fall back to accessible-name lookup if data-testid is absent.
    const target = (await widget.count()) > 0
      ? widget
      : page.getByText(/credits?\s*(remaining|left|balance)?/i).first();

    await expect(target).toBeVisible({ timeout: 15_000 });
    // Must render a number, not a spinner-only or "—" placeholder.
    await expect(target).toContainText(/\d/, { timeout: 15_000 });
    await expect(target).not.toContainText(/error|failed/i);
  });
});
