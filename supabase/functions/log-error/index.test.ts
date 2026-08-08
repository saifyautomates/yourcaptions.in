// Smoke test for the log-error edge function.
// Posts a synthetic error payload, asserts 200 + { ok: true, id }, then
// verifies the row was actually persisted in public.error_logs.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.test({
  name: "log-error returns 200 and inserts a row",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  const marker = `smoketest-${crypto.randomUUID()}`;
  const payload = {
    message: `log-error smoke test ${marker}`,
    stack: "Error: smoke\n    at test (file.ts:1:1)",
    severity: "info",
    source: "frontend",
    url: "https://example.test/smoke",
    user_agent: "deno-test",
    release: "test",
    function_name: "log-error.test",
    context: { marker },
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/log-error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  assertEquals(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  assertEquals(json.ok, true);
  assert(typeof json.id === "string" && json.id.length > 0, "expected row id in response");

  // Verify the row landed in the DB.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("error_logs")
    .select("id, message, severity, source, occurrence_count")
    .eq("id", json.id)
    .single();

  assert(!error, `db lookup failed: ${error?.message}`);
  assert(data, "row not found");
  assertEquals(data!.message, payload.message);
  assertEquals(data!.severity, "info");
  assertEquals(data!.source, "frontend");
  assert((data!.occurrence_count ?? 0) >= 1);
  },
});
