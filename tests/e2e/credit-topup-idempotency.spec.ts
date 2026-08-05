/**
 * E2E — repeating the same top-up is idempotent.
 *
 * The `add_credits` RPC (called by verify-razorpay-payment after a successful
 * charge) is expected to no-op when invoked twice with the same reference_id
 * for a `topup_purchase`. This spec:
 *
 *   1. Snapshots wallet + tx count.
 *   2. Calls add_credits(topup_purchase) with a fresh reference_id — credits +1.
 *   3. Calls it AGAIN with the same reference_id — must not double-credit and
 *      must not insert a second credit_transactions row.
 *
 * Requires SUPABASE_TEST_SESSION_JSON or TEST_EMAIL+TEST_PASSWORD.
 */
import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://scnoehghppfpowggnvhq.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_PROJECT_ID = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
const STORAGE_KEY = `sb-${SUPABASE_PROJECT_ID}-auth-token`;

const SESSION_JSON = process.env.SUPABASE_TEST_SESSION_JSON ?? "";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

const TOPUP_AMOUNT = 11;

async function restoreSession(page: Page) {
  if (!SESSION_JSON) return false;
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, val }) => window.localStorage.setItem(key, val),
    { key: STORAGE_KEY, val: SESSION_JSON },
  );
  return true;
}

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

async function ensureAuthed(page: Page) {
  if (!(await restoreSession(page))) {
    test.skip(
      !TEST_EMAIL || !TEST_PASSWORD,
      "Set SUPABASE_TEST_SESSION_JSON or TEST_EMAIL/TEST_PASSWORD.",
    );
    await signIn(page);
  }
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
}

test.describe("Credits — top-up idempotency", () => {
  test.setTimeout(60_000);

  test("repeating add_credits(topup_purchase) with same reference_id does not double-credit or duplicate txns", async ({ page }) => {
    await ensureAuthed(page);

    const token = await page.evaluate(
      (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}")?.access_token ?? "",
      STORAGE_KEY,
    );
    expect(token).toBeTruthy();
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // caller's user id
    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    expect(meRes.status()).toBe(200);
    const me = (await meRes.json()) as { id: string };

    // fresh reference_id (simulates one Razorpay order)
    const referenceId = crypto.randomUUID();

    // Baseline snapshot
    const walletBefore = (await (await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_wallets?select=plan_credits,topup_credits`,
      { headers },
    )).json())[0];
    const topupBefore = Number(walletBefore.topup_credits);
    const planBefore = Number(walletBefore.plan_credits);

    const call = () =>
      page.request.post(`${SUPABASE_URL}/rest/v1/rpc/add_credits`, {
        headers,
        data: {
          _user_id: me.id,
          _amount: TOPUP_AMOUNT,
          _bucket: "topup",
          _type: "topup_purchase",
          _reference_type: "razorpay_payment",
          _reference_id: referenceId,
          _metadata: { source: "e2e_idempotency_spec" },
        },
      });

    // 1st call — credits.
    const first = await call();
    expect(first.status(), `first call: ${await first.text()}`).toBe(200);

    // 2nd call — must be a no-op.
    const second = await call();
    expect(second.status(), `second call: ${await second.text()}`).toBe(200);

    // 3rd call for good measure.
    const third = await call();
    expect(third.status()).toBe(200);

    // Wallet moved by exactly one increment.
    const walletAfter = (await (await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_wallets?select=plan_credits,topup_credits`,
      { headers },
    )).json())[0];
    expect(Number(walletAfter.topup_credits) - topupBefore).toBe(TOPUP_AMOUNT);
    expect(Number(walletAfter.plan_credits)).toBe(planBefore);

    // Exactly one completed credit_transactions row for this reference_id.
    const txRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_transactions?select=id,type,status,amount&reference_id=eq.${referenceId}`,
      { headers },
    );
    expect(txRes.status()).toBe(200);
    const rows = (await txRes.json()) as Array<{
      id: string; type: string; status: string; amount: number | string;
    }>;
    const completed = rows.filter((r) => r.status === "completed" && r.type === "topup_purchase");
    expect(completed).toHaveLength(1);
    expect(Number(completed[0].amount)).toBe(TOPUP_AMOUNT);
  });
});
