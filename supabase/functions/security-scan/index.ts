// Server-side security scanner. Admin-only. Performs a set of built-in checks
// against the project's Postgres catalog + error_logs and upserts results into
// public.security_findings (keyed by scanner_name + external_id).
import { createClient } from "@supabase/supabase-js";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS" };

type Sev = "info" | "low" | "medium" | "high" | "critical";
interface Check {
  scanner_name: string;
  external_id: string;
  title: string;
  summary: string;
  severity: Sev;
  resource?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const supaUrl = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // AuthN: identify the caller
  const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AuthZ: must be admin
  const admin = createClient(supaUrl, service);
  const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (roleErr || !isAdminData) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const findings: Check[] = [];

  // ---- Check 1: public tables without RLS enabled ----
  const { data: noRlsRows } = await admin
    .from("pg_tables" as any)
    .select("schemaname,tablename,rowsecurity")
    .eq("schemaname", "public");
  for (const r of (noRlsRows ?? []) as any[]) {
    if (r.rowsecurity === false) {
      findings.push({
        scanner_name: "internal.rls",
        external_id: `no-rls:${r.tablename}`,
        title: `Table public.${r.tablename} has RLS disabled`,
        summary: "Row Level Security is not enabled on this public table. Rows can be reached through the Data API without policy checks. Enable RLS and add policies.",
        severity: "high",
        resource: `public.${r.tablename}`,
      });
    }
  }

  // ---- Check 2: recent critical error_logs unresolved ----
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: errs } = await admin
    .from("error_logs")
    .select("fingerprint, severity, message, url, occurrence_count, resolved, last_seen_at")
    .eq("resolved", false)
    .in("severity", ["error", "critical"])
    .gte("last_seen_at", since)
    .limit(50);
  for (const e of (errs ?? []) as any[]) {
    findings.push({
      scanner_name: "internal.errors",
      external_id: `err:${e.fingerprint}`,
      title: `Unresolved ${e.severity} error (${e.occurrence_count}× in 7d)`,
      summary: `${e.message}\n\nURL: ${e.url ?? "n/a"}\nLast seen: ${new Date(e.last_seen_at).toLocaleString()}`,
      severity: e.severity === "critical" ? "critical" : "medium",
      resource: e.url ?? null,
    });
  }

  // ---- Check 3: secrets health — required keys present ----
  const requiredSecrets = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "OPENAI_API_KEY"];
  for (const key of requiredSecrets) {
    if (!Deno.env.get(key)) {
      findings.push({
        scanner_name: "internal.secrets",
        external_id: `missing:${key}`,
        title: `Missing secret: ${key}`,
        summary: `The edge function runtime is missing the ${key} secret. Add it in project secrets.`,
        severity: "high",
        resource: key,
      });
    }
  }

  // Upsert each finding, preserving decisions/notes on existing rows
  let inserted = 0, updated = 0;
  for (const f of findings) {
    const { data: existing } = await admin
      .from("security_findings")
      .select("id,status")
      .eq("scanner_name", f.scanner_name)
      .eq("external_id", f.external_id)
      .maybeSingle();
    if (existing) {
      await admin.from("security_findings").update({
        title: f.title, summary: f.summary, severity: f.severity,
        resource: f.resource ?? null, last_seen_at: new Date().toISOString(),
        // If it was previously fixed but recurred, reopen it.
        ...(existing.status === "fixed" ? { status: "open" } : {}),
      }).eq("id", existing.id);
      updated++;
    } else {
      await admin.from("security_findings").insert({
        scanner_name: f.scanner_name, external_id: f.external_id, title: f.title,
        summary: f.summary, severity: f.severity, resource: f.resource ?? null,
      });
      inserted++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: findings.length, inserted, updated, at: new Date().toISOString() }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
