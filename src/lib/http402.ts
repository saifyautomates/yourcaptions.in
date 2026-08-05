// Global HTTP 402 interceptor.
//
// The backend returns 402 whenever a paid action is blocked (out of credits,
// plan too low, feature gated). The UI usually already reflects this via
// useCredits + UpgradeCTA, but the wallet can drift out of sync (stale cache,
// realtime lag, admin adjustments). This interceptor guarantees a consistent
// UX: any 402 anywhere in the app opens the UpgradeModal and refreshes the
// wallet — even if the button that fired the request wasn't yet disabled.

export type Http402Detail = {
  reason?: string;
  message?: string;
  action?: string;
  url?: string;
  status: 402;
};

export const HTTP_402_EVENT = "app:http-402";

let installed = false;

/** Fire the global upgrade UI. Safe to call from anywhere. */
export function emit402(detail: Omit<Http402Detail, "status">) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<Http402Detail>(HTTP_402_EVENT, {
      detail: { status: 402, ...detail },
    }),
  );
}

/** Inspect a Response for 402 without consuming its body. */
export async function handle402Response(res: Response, action?: string) {
  if (!res || res.status !== 402) return false;
  let reason: string | undefined;
  let message: string | undefined;
  try {
    const clone = res.clone();
    const body = await clone.json().catch(() => null);
    if (body && typeof body === "object") {
      reason = body.reason || body.code;
      message = body.message || body.error;
    }
  } catch {
    /* ignore */
  }
  emit402({ reason, message, action, url: res.url });
  return true;
}

/** Patch window.fetch once so every 402 flows through emit402(). */
export function installHttp402Interceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch;
  try {
    Object.defineProperty(window, "fetch", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await original(input as any, init);
        if (res.status === 402) {
          // Only react to our own backend to avoid noise from third parties.
          const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
          const isOurs =
            url.includes("/functions/v1/") ||
            url.includes("supabase.co/rest") ||
            url.includes(import.meta.env.VITE_SUPABASE_URL ?? "");
          if (isOurs) {
            // Fire-and-forget — body reading is cloned so callers still get theirs.
            void handle402Response(res);
          }
        }
        return res;
      },
    });
  } catch (err) {
    console.warn("Could not install HTTP 402 interceptor on window.fetch", err);
  }
}
