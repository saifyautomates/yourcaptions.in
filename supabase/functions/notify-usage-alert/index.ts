// Fires a usage-threshold email to the signed-in user via the project's
// send-transactional-email function. If app-email infrastructure isn't
// scaffolded yet the invoke will fail — that's fine, we swallow the error
// so the in-app toast still succeeds.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KIND_LABELS: Record<string, string> = {
  caption_seconds: "Caption minutes",
  dub_seconds: "Voiceover minutes",
  export_count: "Video exports",
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

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;
    if (!user || !user.email) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "");
    const pct = Number(body.pct ?? 0);
    const threshold = Number(body.threshold_pct ?? 0);
    const label = KIND_LABELS[kind] ?? kind;

    // Best-effort send; if the template isn't registered or app emails
    // aren't set up, we log and return 200 so the client toast still works.
    let emailDelivered = false;
    try {
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (svc) {
        const admin = createClient(url, svc);
        const res = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "usage-alert",
            recipientEmail: user.email,
            idempotencyKey: `usage-alert-${user.id}-${kind}-${new Date().toISOString().slice(0, 7)}`,
            templateData: {
              meter: label,
              percentUsed: pct,
              threshold,
            },
          },
        });
        emailDelivered = !res.error;
        if (res.error) console.log("usage-alert email send skipped:", res.error.message);
      }
    } catch (e) {
      console.log("usage-alert email send failed:", (e as Error).message);
    }

    return new Response(JSON.stringify({ ok: true, emailDelivered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
