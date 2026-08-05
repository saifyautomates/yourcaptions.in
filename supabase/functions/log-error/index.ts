// Centralized error ingestion endpoint. Called from the frontend (window
// errors, unhandled promise rejections, React error boundary) and from other
// edge functions on catch. Dedupes by fingerprint, and sends an email alert
// to admins the first time a `critical` error is seen (or when a `critical`
// error recurs after being resolved).

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "info" | "warning" | "error" | "critical";
type Source = "frontend" | "edge_function" | "database" | "external";

interface Payload {
  message: string;
  stack?: string;
  severity?: Severity;
  source?: Source;
  url?: string;
  user_agent?: string;
  release?: string;
  function_name?: string;
  user_id?: string | null;
  context?: Record<string, unknown>;
  fingerprint?: string;
}

async function sha1(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function firstStackFrame(stack?: string): string {
  if (!stack) return "";
  const line = stack.split("\n").map((l) => l.trim()).find((l) => l.startsWith("at ")) ?? stack.split("\n")[1] ?? "";
  return line.replace(/:\d+:\d+\)?$/, "").slice(0, 200);
}

// Best-effort in-memory IP rate limit (per isolate). Prevents a single
// attacker from flooding admin inboxes / bloating error_logs.
const IP_HITS = new Map<string, { count: number; windowStart: number }>();
const IP_WINDOW_MS = 60_000;
const IP_MAX_PER_WINDOW = 30;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = IP_HITS.get(ip);
  if (!cur || now - cur.windowStart > IP_WINDOW_MS) {
    IP_HITS.set(ip, { count: 1, windowStart: now });
    return false;
  }
  cur.count += 1;
  return cur.count > IP_MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Payload;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const message = typeof body.message === "string" ? body.message.slice(0, 2000) : "";
  if (!message) {
    return new Response(JSON.stringify({ error: "message_required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const severity: Severity = ["info", "warning", "error", "critical"].includes(body.severity as string)
    ? (body.severity as Severity) : "error";
  const source: Source = ["frontend", "edge_function", "database", "external"].includes(body.source as string)
    ? (body.source as Source) : "frontend";

  const stack = typeof body.stack === "string" ? body.stack.slice(0, 8000) : null;
  const url = typeof body.url === "string" ? body.url.slice(0, 500) : null;
  const ua = typeof body.user_agent === "string" ? body.user_agent.slice(0, 500) : null;
  const release = typeof body.release === "string" ? body.release.slice(0, 100) : null;
  const fnName = typeof body.function_name === "string" ? body.function_name.slice(0, 100) : null;
  const context = body.context && typeof body.context === "object" ? body.context : {};

  // Only trust user_id if it came from a verified session JWT — never from the
  // request body (which any anonymous caller can forge).
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claimsData } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      const sub = claimsData?.claims?.sub;
      if (typeof sub === "string" && /^[0-9a-f-]{36}$/i.test(sub)) userId = sub;
    } catch { /* ignore — treat as anonymous */ }
  }

  // Fingerprint is derived server-side only. Ignore any client-supplied
  // fingerprint so attackers can't force a fresh critical-alert email per
  // request by rotating the value.
  const fpInput = `${source}|${fnName ?? ""}|${message}|${firstStackFrame(stack ?? undefined)}`;
  const fingerprint = await sha1(fpInput);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin.rpc("record_error_log", {
    _fingerprint: fingerprint,
    _severity: severity,
    _source: source,
    _message: message,
    _stack: stack,
    _url: url,
    _user_agent: ua,
    _release: release,
    _function_name: fnName,
    _user_id: userId,
    _context: context,
  });
  if (error) {
    console.error("record_error_log failed", error.message);
    return new Response(JSON.stringify({ error: "insert_failed", details: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const row = Array.isArray(data) ? data[0] : data;

  // Alert admins on critical errors — first sighting, or the first hit after a
  // 15 minute quiet window, so a runaway loop doesn't spam inboxes.
  try {
    const shouldAlert = row?.severity === "critical" &&
      (!row.alerted_at || (Date.now() - new Date(row.alerted_at).getTime()) > 15 * 60 * 1000);
    if (shouldAlert && row?.id) {
      const { data: admins } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const ids = (admins ?? []).map((r: { user_id: string }) => r.user_id);
      if (ids.length) {
        // Best-effort: pull admin emails via auth admin API
        const emails: string[] = [];
        for (const id of ids) {
          const { data: u } = await admin.auth.admin.getUserById(id);
          if (u?.user?.email) emails.push(u.user.email);
        }
        if (emails.length) {
          const esc = (s: string) => s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
          await admin.functions.invoke("send-transactional-email", {
            body: {
              to: emails,
              purpose: "transactional",
              template: "error-alert",
              subject: `[Critical] ${message.slice(0, 80)}`,
              html: `
                <h2>Critical error detected</h2>
                <p><strong>Message:</strong> ${esc(message)}</p>
                <p><strong>Source:</strong> ${esc(source)}${fnName ? ` (${esc(fnName)})` : ""}</p>
                <p><strong>URL:</strong> ${url ? esc(url) : "n/a"}</p>
                <p><strong>Occurrences:</strong> ${row.occurrence_count}</p>
                <pre style="white-space:pre-wrap;font-family:monospace;background:#111;color:#eee;padding:12px;border-radius:6px">${esc((stack ?? "").slice(0, 2000))}</pre>
                <p>View in dashboard: /dashboard/errors</p>
              `,
            },
          }).catch((e) => console.error("alert email failed", e));
          await admin.rpc("mark_error_alerted", { _id: row.id });
        }
      }
    }
  } catch (e) {
    console.error("alerting failed (non-fatal)", (e as Error).message);
  }

  return new Response(JSON.stringify({ ok: true, id: row?.id, is_new: row?.is_new }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
