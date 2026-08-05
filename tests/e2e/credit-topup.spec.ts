/**
 * End-to-end test — credit top-up increases `topup_credits` and writes a
 * matching row into `credit_transactions`.
 *
 * The real top-up flow goes through Razorpay checkout, which cannot run
 * headlessly in CI. To exercise the same server-side code path this spec
 * invokes the SECURITY DEFINER `add_credits` RPC (bucket='topup',
 * type='admin_adjust') — the same RPC the verify-razorpay-payment edge
 * function calls after a successful charge — and then asserts:
 *
 *   1. `topup_credits` on the caller's wallet increased by exactly the
 *      credited amount.
 *   2. A new `credit_transactions` row exists with type='admin_adjust',
 *      matching amount, status='completed', and metadata.bucket='topup'.
 *   3. `balance_after` on the new transaction equals the post-credit
 *      (plan + topup) balance returned by the wallet.
 *
 * Run:
 *   BASE_URL=http://localhost:8080 npx playwright test tests/e2e/credit-topup.spec.ts
 *
 * Requires either:
 *   SUPABASE_TEST_SESSION_JSON  — a full Supabase session JSON blob, OR
 *   TEST_EMAIL + TEST_PASSWORD  — credentials to sign in via UI first.
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

// Small deterministic increment so parallel runs don't collide on exact totals.
const TOPUP_AMOUNT = 7;

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
      "Set SUPABASE_TEST_SESSION_JSON or TEST_EMAIL/TEST_PASSWORD to run authenticated top-up tests.",
    );
    await signInWithPassword(page);
  }
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
}

async function getAccessToken(page: Page): Promise<string> {
  return page.evaluate(
    (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}")?.access_token ?? "",
    STORAGE_KEY,
  );
}

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

test.describe("Credits — top-up increments wallet and writes transaction", () => {
  test.setTimeout(60_000);

  test("add_credits(topup) increases topup_credits and creates a matching credit_transactions row", async ({ page }) => {
    await ensureAuthed(page);

    const token = await getAccessToken(page);
    expect(token, "authenticated access token required").toBeTruthy();
    const headers = authHeaders(token);

    // --- Baseline wallet + latest transaction id -----------------------------
    const walletBeforeRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_wallets?select=plan_credits,topup_credits`,
      { headers },
    );
    expect(walletBeforeRes.status(), "wallet fetch before").toBe(200);
    const walletBeforeRows = (await walletBeforeRes.json()) as Array<{
      plan_credits: number | string;
      topup_credits: number | string;
    }>;
    expect(walletBeforeRows.length, "wallet row must exist").toBeGreaterThan(0);
    const topupBefore = Number(walletBeforeRows[0].topup_credits);
    const planBefore = Number(walletBeforeRows[0].plan_credits);
    expect(Number.isFinite(topupBefore)).toBe(true);

    const txBeforeRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_transactions?select=id&order=created_at.desc&limit=1`,
      { headers },
    );
    expect(txBeforeRes.status(), "credit_transactions before").toBe(200);
    const txBefore = (await txBeforeRes.json()) as Array<{ id: string }>;
    const lastTxId = txBefore[0]?.id ?? null;

    // --- Trigger the same server RPC verify-razorpay-payment calls -----------
    const rpcRes = await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/add_credits`,
      {
        headers,
        data: {
          _user_id: null, // filled below
          _amount: TOPUP_AMOUNT,
          _bucket: "topup",
          _type: "admin_adjust",
          _reference_type: "e2e_test",
          _metadata: { source: "e2e_credit_topup_spec" },
        },
      },
    );
    // We need the caller's own user id — grab it from the JWT payload.
    if (rpcRes.status() === 400 || rpcRes.status() === 500) {
      const userRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      expect(userRes.status(), "auth user lookup").toBe(200);
      const me = (await userRes.json()) as { id: string };
      const retry = await page.request.post(
        `${SUPABASE_URL}/rest/v1/rpc/add_credits`,
        {
          headers,
          data: {
            _user_id: me.id,
            _amount: TOPUP_AMOUNT,
            _bucket: "topup",
            _type: "admin_adjust",
            _reference_type: "e2e_test",
            _metadata: { source: "e2e_credit_topup_spec" },
          },
        },
      );
      expect(retry.status(), `add_credits retry: ${await retry.text()}`).toBe(200);
    } else {
      expect(rpcRes.status(), `add_credits status: ${await rpcRes.text()}`).toBe(200);
    }

    // --- Wallet reflects the top-up -----------------------------------------
    const walletAfterRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_wallets?select=plan_credits,topup_credits`,
      { headers },
    );
    expect(walletAfterRes.status()).toBe(200);
    const walletAfter = ((await walletAfterRes.json()) as Array<{
      plan_credits: number | string;
      topup_credits: number | string;
    }>)[0];
    const topupAfter = Number(walletAfter.topup_credits);
    const planAfter = Number(walletAfter.plan_credits);

    expect(topupAfter - topupBefore, "topup_credits delta").toBe(TOPUP_AMOUNT);
    // Plan bucket must not shift as a side effect of a topup credit.
    expect(planAfter).toBe(planBefore);

    // --- New credit_transactions row exists and matches ---------------------
    const txAfterRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/credit_transactions?select=id,type,amount,balance_after,status,reference_type,metadata,created_at&order=created_at.desc&limit=5`,
      { headers },
    );
    expect(txAfterRes.status()).toBe(200);
    const txRows = (await txAfterRes.json()) as Array<{
      id: string;
      type: string;
      amount: number | string;
      balance_after: number | string;
      status: string;
      reference_type: string | null;
      metadata: Record<string, unknown> | null;
    }>;
    expect(txRows.length).toBeGreaterThan(0);

    const newTx = txRows.find(
      (r) =>
        r.id !== lastTxId &&
        r.type === "admin_adjust" &&
        Number(r.amount) === TOPUP_AMOUNT &&
        r.reference_type === "e2e_test",
    );
    expect(newTx, "a new admin_adjust topup transaction should be recorded").toBeTruthy();
    expect(newTx!.status).toBe("completed");
    expect((newTx!.metadata as any)?.bucket).toBe("topup");
    expect(Number(newTx!.balance_after)).toBe(topupAfter + planAfter);
  });
});
