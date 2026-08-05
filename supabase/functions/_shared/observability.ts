// Server-side observability for edge functions. Sends structured events
// to PostHog via its HTTP capture API when POSTHOG_API_KEY is configured.
// No-ops silently otherwise so callers don't need to gate on env presence.

type Props = Record<string, unknown>;

const POSTHOG_KEY = Deno.env.get("POSTHOG_API_KEY");
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") ?? "https://us.i.posthog.com";

export async function captureServerEvent(
  event: string,
  distinctId: string,
  properties: Props = {},
): Promise<void> {
  if (!POSTHOG_KEY) return;
  try {
    await fetch(`${POSTHOG_HOST.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...properties, source: "edge_function" },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn("posthog capture failed:", (e as Error).message);
  }
}

export const trackRateLimitServer = (
  distinctId: string,
  props: Props,
) => captureServerEvent("rate_limit_exceeded", distinctId, props);

export const trackQuotaExceededServer = (
  distinctId: string,
  props: Props,
) => captureServerEvent("quota_exceeded", distinctId, props);
