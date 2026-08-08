// Records one export against the caller's monthly plan quota.
// Client calls this immediately before starting a video export so we can
// block over-quota exports without doing any encoding work.

import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, makeAdmin } from "../_shared/rate-limit.ts";
import { consumeQuota } from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const user = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await user.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = makeAdmin();
    // Reuse the export rate-limit bucket to prevent hot-loop abuse.
    const rl = await enforceRateLimit(admin, userData.user.id, "meter-export");
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: rl.message }), {
        status: rl.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const q = await consumeQuota(admin, userData.user.id, "export_count", 1);
    if (!q.ok) {
      return new Response(JSON.stringify({ error: q.message, kind: q.kind }), {
        status: q.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, used: q.used, quota: q.quota, remaining: q.remaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
