import { supabase } from "@/integrations/supabase/client";
import { detectRateLimit } from "./rateLimit";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];
type InvokeResult<T> = Awaited<ReturnType<typeof supabase.functions.invoke<T>>>;

export type RetryOptions = {
  /** max attempts including the first call. default 4 */
  maxAttempts?: number;
  /** initial delay in ms, default 500 */
  baseDelayMs?: number;
  /** max delay in ms between attempts, default 8000 */
  maxDelayMs?: number;
  /** if the parsed rate-limit cooldown exceeds this many seconds, stop retrying. default 30 */
  giveUpAfterSeconds?: number;
  /** notify the UI on the final 429 by emitting a rate-limit event. default true */
  emitOnGiveUp?: boolean;
  /** notified per retry attempt for lightweight UI feedback (e.g. toast) */
  onRetry?: (attempt: number, delayMs: number) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract a suggested wait (in ms) from a Supabase FunctionsHttpError.
 * Checks Retry-After header and coarse "minute|hour|day" hints in the message.
 */
const parseCooldownMs = (err: unknown): { ms: number; is429: boolean; windowSeconds: number } => {
  const anyErr = err as {
    message?: string;
    context?: { status?: number; headers?: Headers | Record<string, string> };
    status?: number;
  };
  const status = anyErr?.context?.status ?? anyErr?.status;
  const is429 = status === 429 || /rate.?limit|too many requests/i.test(String(anyErr?.message ?? ""));
  if (!is429) return { ms: 0, is429: false, windowSeconds: 0 };

  // Retry-After header (seconds or HTTP-date)
  const headers = anyErr?.context?.headers;
  let headerVal: string | null = null;
  if (headers) {
    if (typeof (headers as Headers).get === "function") {
      headerVal = (headers as Headers).get("retry-after");
    } else {
      const h = headers as Record<string, string>;
      headerVal = h["retry-after"] ?? h["Retry-After"] ?? null;
    }
  }
  if (headerVal) {
    const secs = Number(headerVal);
    if (!Number.isNaN(secs)) return { ms: secs * 1000, is429: true, windowSeconds: secs };
    const dateMs = Date.parse(headerVal);
    if (!Number.isNaN(dateMs)) {
      const delta = Math.max(0, dateMs - Date.now());
      return { ms: delta, is429: true, windowSeconds: Math.ceil(delta / 1000) };
    }
  }

  const msg = String(anyErr?.message ?? "");
  const windowSeconds = /minute/i.test(msg) ? 60 : /hour/i.test(msg) ? 3600 : /day/i.test(msg) ? 86400 : 60;
  return { ms: windowSeconds * 1000, is429: true, windowSeconds };
};

/**
 * Invoke a Supabase edge function with exponential backoff on 429 responses.
 * Non-429 errors are returned as-is (no retry). On give-up, a rate-limit event
 * is emitted so the persistent UI banner picks it up.
 */
export async function invokeWithRetry<T = unknown>(
  fn: string,
  options?: InvokeOptions,
  retry: RetryOptions = {},
): Promise<InvokeResult<T>> {
  const maxAttempts = retry.maxAttempts ?? 4;
  const baseDelay = retry.baseDelayMs ?? 500;
  const maxDelay = retry.maxDelayMs ?? 8_000;
  const giveUpAfter = retry.giveUpAfterSeconds ?? 30;
  const emitOnGiveUp = retry.emitOnGiveUp ?? true;

  let lastResult: InvokeResult<T> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = (await supabase.functions.invoke<T>(fn, options)) as InvokeResult<T>;
    lastResult = result;

    if (!result.error) return result;

    // 402 quota-exceeded → forward once for abuse/impact monitoring, no retry.
    const status = (result.error as { context?: { status?: number } }).context?.status;
    if (status === 402) {
      import("./observability")
        .then(({ trackQuotaExceeded }) =>
          trackQuotaExceeded({ fn, message: (result.error as Error)?.message ?? "quota exceeded" }),
        )
        .catch(() => {});
      return result;
    }

    const { is429, ms, windowSeconds } = parseCooldownMs(result.error);
    if (!is429) return result;

    if (attempt === maxAttempts || windowSeconds > giveUpAfter) {
      if (emitOnGiveUp) detectRateLimit(result.error, fn);
      return result;
    }

    // exponential backoff with full jitter, clamped by suggested cooldown when short
    const expo = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1));
    const jittered = Math.floor(Math.random() * expo);
    const delay = ms > 0 && ms < maxDelay ? Math.max(jittered, ms) : jittered;
    retry.onRetry?.(attempt, delay);
    await sleep(delay);
  }

  return lastResult as InvokeResult<T>;
}
